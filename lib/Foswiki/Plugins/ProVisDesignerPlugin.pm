package Foswiki::Plugins::ProVisDesignerPlugin;

use strict;
use warnings;

use Foswiki::Func;
use Foswiki::Plugins;

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
  return 1;
}

sub _handleDesignerTag {
  my( $session, $params, $topic, $web, $topicObject ) = @_;

  my $pluginURL = '%PUBURLPATH%/%SYSTEMWEB%/ProVisDesignerPlugin';
  my $style = <<STYLE;
<link rel="stylesheet" type="text/css" media="all" href="$pluginURL/css/provis.ui.css" />
STYLE

  Foswiki::Func::addToZone( 'head', 'PROVIS::DESIGNER::STYLES', $style );

  my $script = <<SCRIPT;
<script type="text/javascript" src="$pluginURL/scripts/deployJava.js"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.js"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.strings.js"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.config.js"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.defaults.js"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.func.js"></script>
<script type="text/javascript" src="$pluginURL/scripts/provis.ui.js"></script>
SCRIPT

  Foswiki::Func::addToZone( 'script', 'PROVIS::DESIGNER::SCRIPTS', $script, 'JQUERYPLUGIN::FOSWIKI' );
  Foswiki::Plugins::JQueryPlugin::createPlugin( 'ui::dialog' );
  Foswiki::Plugins::JQueryPlugin::createPlugin( 'ui::resizable' );
  Foswiki::Plugins::JQueryPlugin::createPlugin( 'ui::tabs' );

  return "";
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
