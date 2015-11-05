#---+ Extensions
#---++ ProVisDesignerPlugin
#---+++ Node Dyeing
# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{EnableDyeing} = 0;

# **STRING**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{Color1} = '#ffffc0';

# **STRING**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{Color2} = '#ffb260';

# **STRING**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{Color3} = '#ff8585';

#---+++ Diagram Printing
# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{InlinePrint} = 0;

# **STRING**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{TopicTitleField} = 'TopicTitle';

# **STRING**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{ApprovedField} = 'FREIGEGEBEN';

#---+++ Node Visibility
# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideProcess} = 0;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideTitle} = 1;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideDecision2} = 0;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideDocument} = 0;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideDatabase} = 0;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideTerminator} = 0;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideEllipse} = 0;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideComment} = 0;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideDecision} = 1;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideSubprocess} = 1;

# **BOOLEAN**
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HideOperation} = 1;

#---+++ Even more settings
# **BOOLEAN EXPERT**
# pro: off
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{CenterChildren} = 1;

# **BOOLEAN EXPERT**
# pro: on
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{ResizeLanes} = 0;

# **STRING EXPERT**
# pro: 511
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{EnabledHandles} = 256;

# **STRING EXPERT**
# pro: 4
$Foswiki::cfg{Plugins}{ProVisDesignerPlugin}{HandlesStyle} = 7;
