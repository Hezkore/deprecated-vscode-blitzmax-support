SuperStrict

' Modules
Framework BRL.StandardIO

' Imports
Import "tapp.bmx"

Global App:TApp

OnEnd( EndApp )
Main( AppArgs )

Function Main( args:string[] )
	
	App = New TApp( args )
	
	If App Then App.Run()
EndFunction

Function EndApp()
	
	If App Then App.Discard()
EndFunction