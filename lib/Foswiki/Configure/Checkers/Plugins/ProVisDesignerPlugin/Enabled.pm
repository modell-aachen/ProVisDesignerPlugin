package Foswiki::Configure::Checkers::Plugins::ProVisDesignerPlugin::Enabled;

use strict;
use warnings;

use Foswiki::Configure::Checker ();
our @ISA = qw( Foswiki::Configure::Checker );

sub check {
  my $this = shift;
  my $warnings;

  if ( $Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{Enabled} ) {
    if ( !$Foswiki::cfg{Plugins}{JQueryPlugin}{Enabled} ) {
      $warnings .= $this->ERROR( 'ProVisDesigner depends on JQueryPlugin, which is not enabled.' );
    } else {
      if ( !$Foswiki::cfg{JQueryPlugin}{Plugins}{BlockUI}{Enabled} ) {
        $warnings .= $this->ERROR( 'JQuery::BlockUI is required by ProVisDesigner!' );
      }

      if ( !$Foswiki::cfg{JQueryPlugin}{Plugins}{UI}{Enabled} ) {
        $warnings .= $this->ERROR( 'JQuery::UI is required by ProVisDesigner' );
      }
    }
  }

  return $warnings;
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
