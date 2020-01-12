SuperStrict

' Modules
Framework BRL.StandardIO

' Imports
Import "window.bmx"

Global Window:TWindow

OnEnd( EndApp )
Main( AppArgs )

Function Main( args:string[] )
	
	Window = New TWindow( "My Window", 640, 480 )
	
	Repeat
		
		WaitEvent()
		If Window Then Window.OnEvent()
	Forever
EndFunction

Function EndApp()
	
	If Window Then Window.Discard()
EndFunction