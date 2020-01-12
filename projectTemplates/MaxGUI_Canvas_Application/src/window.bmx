SuperStrict

' Modules
Import MaxGui.Drivers
Import BRL.EventQueue
Import BRL.GLMax2D
Import BRL.Timer
Import BRL.TimerDefault

' Imports
'Import ""

Type TWindow
	
	Field flags:Int
	Field gadget:TGadget
	Field renderTimer:TTimer
	Field canvas:TGadget
	
	Method New( title:String, width:Int, height:Int )
		
		Self.SetupFlags()
		Self.gadget = CreateWindow( title, 0, 0, width, height, Null, Self.flags )
		
		If gadget And (flags & WINDOW_STATUS) Then
			
			SetStatusText( gadget, "Left aligned~tCenter aligned~tRight aligned" )
		EndIf
		
		SetupCanvas()
	EndMethod
	
	Method SetupCanvas()
		
		Self.canvas = CreateCanvas( 0, 0, ClientWidth( Self.gadget ), ClientHeight( Self.gadget ), Self.gadget )
		SetGadgetLayout( Self.canvas, EDGE_ALIGNED, EDGE_ALIGNED, EDGE_ALIGNED, EDGE_ALIGNED )
		
		renderTimer = CreateTimer( 60 )
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
			
			Case EVENT_TIMERTICK
				If EventSource() = Self.renderTimer Then
					
					RedrawGadget( Self.canvas )
				EndIf
				
			Case EVENT_GADGETPAINT
				If EventSource() = Self.canvas Then
					
					OnRender()
				EndIf
				
			Default
				Print( CurrentEvent.ToString() )
		EndSelect
	EndMethod
	
	Method OnRender()
		
		SetGraphics( CanvasGraphics( Self.canvas ) )
		SetOrigin( 160,120 )
		SetLineWidth( 5 )
		
		Cls()
		
		Local t:Int = MilliSecs()
		
		DrawLine( 0, 0, Float( 120*Cos( t ) ), Float( 120*Sin( t ) ) )
		DrawLine( 0, 0, Float( 80*Cos( t/60 ) ), Float( 80*Sin( t/60 ) ) )
		
		Flip()
	EndMethod
	
	Method Discard()
		
		Print( "Discard Window" )
	EndMethod
EndType