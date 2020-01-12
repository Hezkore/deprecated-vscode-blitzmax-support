SuperStrict

rem
bbdoc: Category/Name
about:
Description
endrem
Module EXAMPLE.$WORKSPACE_NAME

ModuleInfo "Version: 1.00"
ModuleInfo "Author: Your Name"
ModuleInfo "License: MIT"
ModuleInfo "Copyright: $CURRENT_YEAR Your Name"

ModuleInfo "History: 1.00"
ModuleInfo "History: Initial Release"

' Dependencies
Import BRL.StandardIO

' Imports
' Import ""

rem
bbdoc: Initialize module
about:
This function will initialize the module
Pass @someText a string to print it
endrem
Function Init( someText:String )
	
	Print( "Module initialized" )
	Print( someText )
EndFunction