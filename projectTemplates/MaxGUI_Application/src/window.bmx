SuperStrict

' Modules
Import MaxGui.Drivers
Import BRL.EventQueue

' Imports
'Import ""

Type TWindow
	
	Field flags:Int
	Field gadget:TGadget
	
	Method New( title:String, width:Int, height:Int )
		
		Self.SetupFlags()
		Self.gadget = CreateWindow( title, 0, 0, width, height, Null, Self.flags )
		
		
		If gadget And (flags & WINDOW_STATUS) Then
			
			SetStatusText( gadget, "Left aligned~tCenter aligned~tRight aligned" )
		EndIf
	EndMethod
	
	Method SetupFlags()
		
		flags = Null
		
		flags:| WINDOW_TITLEBAR
		flags:| WINDOW_RESIZABLE
		'flags:| WINDOW_MENU
		flags:| WINDOW_STATUS
		'flags:| WINDOW_CLIENTCOORDS
		'flags:| WINDOW_HIDDEN
		'flags:| WINDOW_ACCEPTFILES
		'flags:| WINDOW_TOOL
		flags:| WINDOW_CENTER
	EndMethod
	
	Method OnEvent()
		
		Select EventID()
			
			Case EVENT_APPTERMINATE
				End
			
			Case EVENT_WINDOWCLOSE
				If EventSource() = Self.gadget Then End
			
			Default
				Print( CurrentEvent.ToString() )
		EndSelect
	EndMethod
	
	Method Discard()
		
		Print( "Discard Window" )
	EndMethod
EndType