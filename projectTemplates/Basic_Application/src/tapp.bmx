SuperStrict

' Modules
Import BRL.StandardIO

' Imports
' Import ""

Type TApp
	
	Method New( args:string[] )
		
		Print( "App Start" )
	EndMethod
	
	Method Run()
		
		Print( "App Running" )
	EndMethod
	
	Method Discard()
		
		Print( "App End" )
	EndMethod
EndType