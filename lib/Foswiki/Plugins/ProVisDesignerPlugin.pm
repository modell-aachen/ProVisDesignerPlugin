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
<link rel="stylesheet" type="text/css" media="all" href="$pluginURL/bootstrap/bootstrap.min.css?version=$RELEASE" />
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
    image: '$pubPath/$systemWeb/ProVisDesignerPlugin/assets/ma-logo.png',
    boxbgcolor: '#ffffff',
    boxborder: 'false',
    centerimage: 'false',
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

  GenFileName:
  while ($fileName eq 'ProVis_') {
    # Auto-generate name
    $fileName .= sprintf("%08x_%04x", time, int(rand(65536)));
    for (qw(aqm map png)) {
      if (Foswiki::Func::attachmentExists($web, $topic, "$fileName.$_")) {
        $fileName = 'ProVis_';
        next GenFileName;
      }
    }
  }

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
          hide    => 1,
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
