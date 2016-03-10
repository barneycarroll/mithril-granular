import m, { traps } from 'mithril-proxy'

// Live bindings between controllers and their corresponding components
// ...live DOM root elements
const ctrlEls   = new WeakMap()
// ...view functions partially applied with their last input
const ctrlViews = new WeakMap()
// Root components have special considerations
const roots     = new Set()

// Controllers for components currently scheduled for granular redraw
const hotCtrls  = new Set()

// Is the next redraw a granular one? Not by default
let   granular  = false

// Ensure it's reset at the end of every draw
m.mount( document.createElement( 'div' ), {
  view : () =>
    m( 'div', { config : () => granular = false } )
} )

// Render a given component
const render    = ctrl => {
  const el     = ctrlEls.get( ctrl )
  const view   = ctrlViews.get( ctrl )
  const parent = el.parentNode
  const output = roots.has( ctrl )
    ? view()
    : Array.from( parent.children )
      .map( child => 
        child === el 
        ? view()
        : { subtree : 'retain' }
      )

  // Compute the scheduled views & render in place 
  m.render( parent, output )

  // Update schedule
  hotCtrls.delete( ctrl )
}

// On root view computation, arrange a granular render if necessary
traps.root.view.push( view =>
  function( ctrl ){
    roots.set( ctrl )
  
    // If we have nothing scheduled, or if this component was scheduled proceed as normal
    if( !granular || hotCtrls.has( ctrl ) )
      return view.apply( this, arguments )

    // Otherwise render the controls
    Array.from( hotCtrls ).map( render )

    // Noop this view
    return { subtree : 'retain' }
  }
)

// Bind controller instances to their views & root DOM elements 
traps.view.push( view =>
  function( ctrl ){
    const call   = view.bind( this, ...arguments )
    const output = call()
    const { attrs : { config } } = output.length 
      ? output[ 0 ] 
      : output

    ctrlViews.set( ctrl, call )
    
    attrs.config = function( el ){
      ctrlEls.set( ctrl, el )

      if( config )
        config.apply( this, arguments )
    }

    return output
  }
)

// The API is an m.redraw overload:
traps.redraw.push( redraw => 
  // Pass a controller instance to m.redraw (followed by component input if desired)
  // in order to schedule its component's granular redraw
  function( ctrl ){
    // If a live controller instance was passed in
    if( ctrlViews.has( ctrl ) ){
      // We're dealing with a granular redraw request
      granular = true

      // Has new input been supplied?
      if( arguments.length > 1 )
        // If so, apply it to the associated view
        ctrlViews.set( ctrl, ctrlViews.get( ctrl ).bind( this, ...arguments ) )

      // Add this component to the list
      hotCtrls.add( ctrl )
    }
    
    // Pass through the proxy
    return redraw.apply( this, arguments )
  }
)

export default m
