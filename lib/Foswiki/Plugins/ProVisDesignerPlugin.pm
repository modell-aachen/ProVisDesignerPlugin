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
<link rel="stylesheet" type="text/css" media="all" href="$pluginURL/bootstrap/bootstrap.min.css" />
<link rel="stylesheet" type="text/css" media="all" href="$pluginURL/css/provis.ui.css?version=$RELEASE" />
STYLE

  Foswiki::Func::addToZone( 'head', 'PROVIS::DESIGNER::STYLES', $style );

  my $script = <<SCRIPT;
<script type="text/javascript" src="$pluginURL/bootstrap/bootstrap.min.js"></script>
<script type="text/javascript" src="$pluginURL/scripts/deployJava.js"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.js?version=$RELEASE"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.strings.js?version=$RELEASE"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.config.js?version=$RELEASE"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.themes.js?version=$RELEASE"></script>
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
    DiagramData: 'rO0ABXQABEpEZyp3BAAAAAhzcgAqY29tLm1pbmRmdXNpb24uZGlhZ3JhbW1pbmcuRGlhZ3JhbU5vZGVMaXN0AAAAAAAAAAEMAAB4cgAjY29tLm1pbmRmdXNpb24uZGlhZ3JhbW1pbmcuQmFzZUxpc3QAAAAAAAAAAQwAAHhwdwQAAAAAeHNyACpjb20ubWluZGZ1c2lvbi5kaWFncmFtbWluZy5EaWFncmFtTGlua0xpc3QAAAAAAAAAAQwAAHhxAH4AAncEAAAAAHhzcgAqY29tLm1pbmRmdXNpb24uZGlhZ3JhbW1pbmcuRGlhZ3JhbUl0ZW1MaXN0AAAAAAAAAAEMAAB4cQB+AAJ3BAAAAAB4c3IAJGNvbS5taW5kZnVzaW9uLmRpYWdyYW1taW5nLkdyb3VwTGlzdAAAAAAAAAABDAAAeHEAfgACdwQAAAAAeHNyACRjb20ubWluZGZ1c2lvbi5kaWFncmFtbWluZy5TZWxlY3Rpb24AAAAAAAAAAQwAAHhyACZjb20ubWluZGZ1c2lvbi5kaWFncmFtbWluZy5EaWFncmFtSXRlbQAAAAAAAAABDAAAeHBwdAAAdwEAcQB+AA13DD+AAAAAAAAAAAABAXBwc3IAHmNvbS5taW5kZnVzaW9uLmRpYWdyYW1taW5nLlBlbgAAAAAAAAABDAAAeHBzcgAOamF2YS5hd3QuQ29sb3IBpReDEI8zdQIABUYABmZhbHBoYUkABXZhbHVlTAACY3N0ABtMamF2YS9hd3QvY29sb3IvQ29sb3JTcGFjZTtbAAlmcmdidmFsdWV0AAJbRlsABmZ2YWx1ZXEAfgASeHAAAAAA/wAAAHBwcHcEAAAAAHB4dwgAAAAAAAAAAHB3AgABc3EAfgAGdwQAAAAAeHNxAH4AAXcEAAAAAHhzcQB+AAR3BAAAAAB4dxAAAAAAAAAAAAAAAAAAAAAAeHckAAAAAsFwAADBcAAARJKQAERUoADBcAAAwXAAAESSkABEVKAAcHcEAAAAAHNyAC5jb20ubWluZGZ1c2lvbi5kaWFncmFtbWluZy5FeHRlcm5hbGl6YWJsZUltYWdlAAAAAAAAAAEMAAB4cHcBAHh3CAAAAGAAAABgcHcYAAAAAAAAAAABAAAAAQEBAQAAAQAAAAAAc3IAJWNvbS5taW5kZnVzaW9uLmRpYWdyYW1taW5nLlNvbGlkQnJ1c2gAAAAAAAAAAQwAAHhyACBjb20ubWluZGZ1c2lvbi5kaWFncmFtbWluZy5CcnVzaE6dO2gw1HskDAAAeHBzcQB+ABAAAAAA/////3BwcHhzcQB+ABAAAAAA/25ujHBwcHcWAAAAAT+AAAA/gAAAAAAAAgFBAAAAAXNxAH4AEAAAAAD/////cHBwc3EAfgAQAAAAAP+qqqpwcHBzcQB+ABAAAAAA/8gAAHBwcHcPAAAAAAFAoAAAAQAAAAEBc3EAfgAQAAAAAP/u7u5wcHB3CUFwAABBcAAAAXNxAH4AEAAAAAD/AAAAcHBwdAAJUmVjdGFuZ2xlc3EAfgAOc3EAfgAQAAAAAP8AAABwcHB3BAAAAABweHNxAH4AGXNxAH4AEAAAAAD/ZJTIcHBweHchAAAABQAAAAAAAAAAAAAAAAAAAAABAAAAAQAAAAQAAAACdAAFVGFibGV3DECgAABBkAAAQMAAAHNxAH4ADnNxAH4AEAAAAAD/AAAAcHBwdwQAAAAAcHhzcQB+ABlzcQB+ABAAAAAA/7SgoHBwcHh3DAAAAAAAAgAAAAIAAnNxAH4ADnNxAH4AEAAAAAD/MzMzcHBwdwQ/oAAAcHhzcQB+ABlzcQB+ABAAAAAA/5mZmXBwcHh3JQAAAAYAAAAAAAAAAEFAAABAoAAAQKAAAAAAAAABAAEAAQAAAAJzcgANamF2YS5hd3QuRm9udMWhNebM3lZzAwAGSQAZZm9udFNlcmlhbGl6ZWREYXRhVmVyc2lvbkYACXBvaW50U2l6ZUkABHNpemVJAAVzdHlsZUwAFGZSZXF1ZXN0ZWRBdHRyaWJ1dGVzdAAVTGphdmEvdXRpbC9IYXNodGFibGU7TAAEbmFtZXQAEkxqYXZhL2xhbmcvU3RyaW5nO3hwAAAAAUCAAAAAAAAEAAAAAHNyABNqYXZhLnV0aWwuSGFzaHRhYmxlE7sPJSFK5LgDAAJGAApsb2FkRmFjdG9ySQAJdGhyZXNob2xkeHA/QAAAAAAACHcIAAAACwAAAAN0ACRzdW4uZm9udC5hdHRyaWJ1dGV2YWx1ZXMuZGVmaW5lZF9rZXlzcgARamF2YS5sYW5nLkludGVnZXIS4qCk94GHOAIAAUkABXZhbHVleHIAEGphdmEubGFuZy5OdW1iZXKGrJUdC5TgiwIAAHhwAEAAf3NyABtqYXZhLmF3dC5mb250LlRleHRBdHRyaWJ1dGVreJ2MDegNRgIAAHhyAC9qYXZhLnRleHQuQXR0cmlidXRlZENoYXJhY3Rlckl0ZXJhdG9yJEF0dHJpYnV0ZYEedCbNRxdcAgABTAAEbmFtZXEAfgAzeHB0AAZmYW1pbHl0AAVBcmlhbHNxAH4AO3QABHNpemVzcgAPamF2YS5sYW5nLkZsb2F02u3Jots88OwCAAFGAAV2YWx1ZXhxAH4AOUCAAAB4cQB+AD94cQB+AA1xAH4ADXcKAAAAAQAAAAEAAHNxAH4ADnNxAH4AEAAAAAD/h876cHBwdwQ/AAAAcHh3BEEgAABzcgAuY29tLm1pbmRmdXNpb24uZGlhZ3JhbW1pbmcuWERpbWVuc2lvbjJEJERvdWJsZQAAAAAAAAABDAAAeHB3EEBJAAAAAAAAQEQAAAAAAAB4dAAJQ29udGFpbmVydwVAoAAAAXB3BAAAAAA='
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
