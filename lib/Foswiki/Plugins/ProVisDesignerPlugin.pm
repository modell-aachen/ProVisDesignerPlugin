package Foswiki::Plugins::ProVisDesignerPlugin;

use strict;
use warnings;

use Foswiki::Func;
use Foswiki::Plugins;

use File::Temp ();
use MIME::Base64;
use Encode;
use JSON;

use version;
our $VERSION = version->declare( '1.0.0' );
our $RELEASE = "1.0";
our $NO_PREFS_IN_TOPIC = 1;
our $SHORTDESCRIPTION = 'Provides a Java based process designer.';

sub initPlugin {
  my ( $topic, $web, $user, $installWeb ) = @_;

  if ( $Foswiki::Plugins::VERSION < 2.0 ) {
    Foswiki::Func::writeWarning( 'Version mismatch between ',
      __PACKAGE__, ' and Plugins.pm' );
    return 0;
  }

  Foswiki::Func::registerTagHandler( 'PROVISDESIGNER', \&_handleDesignerTag );
  Foswiki::Func::registerTagHandler( 'PROCESS', \&_DRAWING );
  Foswiki::Func::registerRESTHandler( 'upload', \&_restUpload, authenticate => 1, http_allow => 'POST' );
  Foswiki::Func::registerRESTHandler( 'update', \&_restUpdate, authenticate => 1, http_allow => 'POST' );
  return 1;
}

sub returnRESTResult {
  my ( $response, $status, $text ) = @_;

  $response->header(
      -status  => $status,
      -type    => 'text/plain',
      -charset => 'UTF-8'
     );
  $response->print($text);

  print STDERR $text if ( $status >= 400 );
}

# Tag handler
sub _DRAWING {
  my ( $session, $attributes, $topic, $web ) = @_;

  my $drawingName = $attributes->{_DEFAULT} || $attributes->{name} || 'untitled';

  #Alex: Wenn kein rev Attribut vorhanden ist, soll der letzte Stand genutzt werden
  my $drawingRevision = int($attributes->{pngrev} || 0) || int($attributes->{rev} || 0);

  #Alex: Type laden, oder Standard setzen
  my $drawingType = lc($attributes->{type}) || 'swimlane';

  $drawingName = ( Foswiki::Func::sanitizeAttachmentName($drawingName) )[0];
  #Alex: Revision des angezeigten Topic / Kann man das noch besser machen?
  my $query = $session->{request};

  my $imgParams;
  if ($drawingRevision != 0) {
    $imgParams = { src => "%SCRIPTURL{viewfile}%/%WEB%/%TOPIC%/$drawingName.png?rev=$drawingRevision" };
  } else {
    my $imgTime =
      Foswiki::Func::getRevisionInfo($web, $topic, 0, "$drawingName.png");
    $imgParams = { src => "%PUBURLPATH%/%WEB%/%TOPIC%/$drawingName.png?t=$imgTime" };
  }

  my $result = '';
  my $mapFile = "$drawingName.map";
  if ( Foswiki::Func::attachmentExists( $web, $topic, $mapFile ) ) {
    my $map = Foswiki::Func::readAttachment( $web, $topic, $mapFile );

    my $mapname = $drawingName;
    $imgParams->{usemap} = "#$mapname";

    # Unashamed hack to handle Web.TopicName links
    # Alex: Das muss noch gemacht werden
    $map =~ s!href=(["'])(.*?)\1!_processHref($2, $web)!ige;
    $map =~ s/>\s*/>/g;
    $map =~ s/(?<!=)"\s+/" /g;
    # Ugly hack to prevent Foswiki auto-linkification inside ALT attr
    $map =~ s/(alt="[^"]*http):([^"]+")/$1&#58;$2/gi;

    Foswiki::Func::setPreferencesValue( 'MAPNAME',     $mapname );

    $map = Foswiki::Func::expandCommonVariables( $map, $topic );
    $result .= CGI::img($imgParams) . $map;
  }
  else {
    # insensitive drawing; the whole image gets a rather more
    # decorative version of the edit URL
    $result             = CGI::img($imgParams);
  }

  my $twisty = lc(Foswiki::Func::getPreferencesValue("PROVIS_TWISTY")) || 'off';
  return $result if ($twisty eq 'off');
  return "%TWISTY{start=\"". (($twisty eq 'open') ? 'show' : 'hide') ."\" ".
    "hidelink=\"%MAKETEXT{Hide flowchart...}%\" ".
    "showlink=\"%MAKETEXT{Show flowchart...}%\" ".
    "}%$result%ENDTWISTY%";
}

sub _handleDesignerTag {
  my( $session, $params, $topic, $web, $topicObject ) = @_;

  my $pluginURL = '%PUBURLPATH%/%SYSTEMWEB%/ProVisDesignerPlugin';
  my $style = <<STYLE;
<link rel="stylesheet" type="text/css" media="all" href="$pluginURL/css/provis.ui.css?version=$RELEASE" />
STYLE

  Foswiki::Func::addToZone( 'head', 'PROVIS::DESIGNER::STYLES', $style );

  my $script = <<SCRIPT;
<script type="text/javascript" src="$pluginURL/bootstrap/bootstrap.min.js?version=$RELEASE"></script>
<script type="text/javascript" src="$pluginURL/scripts/deployJava.js?version=$RELEASE"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.js?version=$RELEASE"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.ui.js?version=$RELEASE"></script>
SCRIPT

  Foswiki::Func::addToZone( 'script', 'PROVIS::DESIGNER::SCRIPTS', $script, 'JQUERYPLUGIN::FOSWIKI' );

  # jQuery.disableSelection/jQuery.enableSelection
  Foswiki::Plugins::JQueryPlugin::createPlugin( 'ui' );
  Foswiki::Plugins::JQueryPlugin::createPlugin( 'blockui' );

  my $pubPath = Foswiki::Func::getPubUrlPath();
  my $systemWeb = $Foswiki::cfg{SystemWebName} || 'System';

  my $keyTopic = "PROVIS_CONFIG_TOPIC";
  my $keySection = "PROVIS_CONFIG_SECTION";
  my $cfgTopic = Foswiki::Func::getPreferencesValue( $keyTopic );
  my $section = Foswiki::Func::getPreferencesValue( $keySection );

  $cfgTopic = "System.ProVisDesignerPlugin" unless $cfgTopic;
  $section = "PROVISCONFIG" unless $section;

  my $macro = "%INCLUDE{\"$cfgTopic\" section=\"$section\" warn=\"off\"}%";
  my $config = Foswiki::Func::expandCommonVariables( $macro );

  #todo error if $config undefined
  my $encoded = encode_base64( $config );
  $encoded =~ s/\n//g;

  my $deployJava = <<SCRIPT;
<!--
deployJava.runApplet( {
    id: 'jDiagApplet',
    codebase: '$pubPath/$systemWeb/ProVisDesignerPlugin/applet/',
    code: 'com.mindfusion.diagramming.DiagramApplet',
    archive: 'ProVis.jar',
    width: '800px',
    height: '600px'
  }, {

    separate_jvm: 'true',
    ProVisConfig: '$encoded',
    AppletStarted: 'appletStarted',
    DiagramData: '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'
});
//-->
SCRIPT

  if ( Foswiki::Func::getContext()->{SafeWikiSignable} ) {
    Foswiki::Plugins::SafeWikiPlugin::Signatures::permitInlineCode( $deployJava );
  }

  return qq[<script type="text/javascript">$deployJava</script>];
}

sub _processHref {
  my ( $link, $defweb ) = @_;

  # Skip processing naked anchor links, protocol links, and special macros
  unless ( $link =~
    m/^(%FOSWIKIDRAW%|%TWIKIDRAW%|#|$Foswiki::cfg{LinkProtocolPattern})/ )
  {
    my $anchor = '';
    if ( $link =~ s/(#.*)$// ) {
      $anchor = $1;
    }

    my ( $web, $topic ) = Foswiki::Func::normalizeWebTopicName( $defweb, $link );
    $link = "%SCRIPTURLPATH{view}%/$web/$topic$anchor";
  }

  return "href=\"$link\"";
}

sub _getTopic {
  my ( $session, $plugin, $verb, $response ) = @_;
  my $query = Foswiki::Func::getCgiQuery();
  my ( $web, $topic ) =
    Foswiki::Func::normalizeWebTopicName( undef, $query->param('topic') );

  # Check that we have access to the topic
  unless (Foswiki::Func::checkAccessPermission(
    'CHANGE', Foswiki::Func::getCanonicalUserID(), undef, $topic, $web )) {
    returnRESTResult( $response, 401, "Access denied" );
    return ();
  }
  $web = Foswiki::Sandbox::untaint(
    $web, \&Foswiki::Sandbox::validateWebName );
  $topic = Foswiki::Sandbox::untaint( $topic,
    \&Foswiki::Sandbox::validateTopicName );
  unless ( defined $web && defined $topic ) {
    returnRESTResult( $response, 401, "Access denied" );
    return ();
  }
  unless ( Foswiki::Func::checkAccessPermission(
    'CHANGE', Foswiki::Func::getWikiName(), undef, $topic, $web )) {
    returnRESTResult( $response, 401, "Access denied" );
    return ();
  }

  return ($web, $topic);
}

sub _unescape {
  my $d = shift;
  $d =~ s/%([\da-f]{2})/chr(hex($1))/gei;
  return $d;
}

# REST handler
sub _restUpload {
  my ( $session, $plugin, $verb, $response ) = @_;
  my $query = Foswiki::Func::getCgiQuery();

  my ($web, $topic) = _getTopic( @_ );
  return unless $web && $topic;

  # Basename of the drawing
  my $fileName    = $query->param('drawing');
  # ASSERT($fileName, $query->Dump()) if DEBUG;

  # GenFileName:
  # while ($fileName eq 'ProVis_') {
  #   # Auto-generate name
  #   $fileName .= sprintf("%08x_%04x", time, int(rand(65536)));
  #   for (qw(aqm map png)) {
  #     if (Foswiki::Func::attachmentExists($web, $topic, "$fileName.$_")) {
  #       $fileName = 'ProVis_';
  #       next GenFileName;
  #     }
  #   }
  # }

  my $origName = $fileName;
  Foswiki::Func::setSessionValue($web.$topic.'name', $origName);


  # SMELL: call to unpublished function
  ( $fileName, $origName ) =
    Foswiki::Sandbox::sanitizeAttachmentName($fileName);

  # Save a file for each file type
  my @errors;
  my %revisions;
  foreach my $ftype (qw(aqm map png)) {
    my $content = $query->param($ftype);
    next unless defined $content;
    if ($ftype eq 'png') {
      # PNG is passed base64 encoded
      $content = MIME::Base64::decode_base64($content);
    }

    my $ft = new File::Temp(); # will be unlinked on destroy
    my $fn = $ft->filename();
    binmode($ft);
    print $ft $content;
    close($ft);

    my $error = Foswiki::Func::saveAttachment(
      $web, $topic,
      "$fileName.$ftype",
        {
          dontlog     => !$Foswiki::cfg{Log}{upload},
          comment     => "ProVisPlugin Upload",
          filedate    => time(),
          file        => $fn,
          # hide    => 1,
          attr => 'ht'
        });
    if ($error) {
      print STDERR "ProVis Attachment save error $error\n";
      push(@errors, $error );
    }

    my (undef, undef, $revinfo, undef) = Foswiki::Func::getRevisionInfo($web, $topic, 0, "$fileName.$ftype");
    $revisions{$ftype} = $revinfo || 0;
  }

  if (scalar(@errors)) {
    print STDERR "PROVIS SAVE FAILED\n";
    returnRESTResult( $response, 500, join(' ', @errors ));
  } else {
    returnRESTResult( $response, 200, encode_json({
      web => $web, topic => $topic,
      name => "$fileName",
      aqmrev => $revisions{aqm},
      maprev => $revisions{map},
      pngrev => $revisions{png},
    }));
  }

  return undef;
}


sub _restUpdate {
  my ( $session, $plugin, $verb, $response ) = @_;
  my $query = Foswiki::Func::getCgiQuery();

  my $web = $query->param( 'w' );
  my $topic = $query->param( 't' );

  return unless $web && $topic;

  my $name = $query->param( 'name' );
  my $aqmrev = $query->param( 'aqmrev' );
  my $pngrev = $query->param( 'pngrev' );
  my $maprev = $query->param( 'maprev' );

  my ( $meta, $text ) = Foswiki::Func::readTopic( $web, $topic );
  while( $text =~ /(%PROCESS{.*}%)/g ) {
    my $macro = $1;
    my %params = Foswiki::Func::extractParameters( $1 =~ /{(.*)}/ );
    if ( $params{name} eq $name ) {
      my $newProcess = "%PROCESS{name=\"$name\" type=\"swimlane\" aqmrev=\"$aqmrev\" maprev=\"$maprev\" pngrev=\"$pngrev\"}%";
      $text =~ s/$macro/$newProcess/;
      Foswiki::Func::saveTopic( $web, $topic, $meta, $text, { dontlog => 1 } );
      return;
    }
  }
}
1;

__END__
Foswiki - The Free and Open Source Wiki, http://foswiki.org/

Copyright (C) 2013 Modell Aachen GmbH

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
