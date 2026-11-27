'use client';
import {Children,useCallback,useEffect,useId,useRef,useState} from 'react';

/** Native touch scrolling: swiping never activates a card or a paid operation. */
export default function RealizoSwipeRail({children,label='Opciones deslizables',className='',compact=false}) {
 const items=Children.toArray(children).filter(Boolean);
 const track=useRef(null);
 const trackId=useId();
 const [position,setPosition]=useState({index:0,previous:false,next:items.length>1});
 const sync=useCallback(()=>{
   const node=track.current;
   if(!node)return;
   const cards=Array.from(node.children);
   if(!cards.length)return;
   const scrollLeft=node.scrollLeft;
   const max=Math.max(0,node.scrollWidth-node.clientWidth);
   let closest=0,distance=Infinity;
   cards.forEach((card,index)=>{
     const start=card.offsetLeft-cards[0].offsetLeft;
     const delta=Math.abs(scrollLeft-start);
     if(delta<distance){closest=index;distance=delta;}
   });
   setPosition(old=>{
     const next={index:closest,previous:scrollLeft>5,next:scrollLeft<max-5};
     return old.index===next.index&&old.previous===next.previous&&old.next===next.next?old:next;
   });
 },[]);
 useEffect(()=>{
   sync();
   const node=track.current;
   if(!node||typeof ResizeObserver==='undefined')return;
   const observer=new ResizeObserver(sync);
   observer.observe(node);
   return ()=>observer.disconnect();
 },[sync,items.length]);
 function go(direction){
   const node=track.current;
   if(!node)return;
   const cards=Array.from(node.children);
   if(!cards.length)return;
   const target=Math.max(0,Math.min(cards.length-1,position.index+direction));
   const left=cards[target].offsetLeft-cards[0].offsetLeft;
   const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   node.scrollTo({left,behavior:reduce?'auto':'smooth'});
 }
 return <div className={'ra-carousel'+(compact?' ra-carousel-compact':'')} role="region" aria-roledescription="carrusel" aria-label={label}>
  <div id={trackId} ref={track} onScroll={sync} className={'ra-swipe-track '+className} tabIndex={0}>
   {children}
  </div>
  {items.length>1&&<div className="ra-carousel-controls">
    <span className="ra-carousel-hint">Desliza para explorar <span aria-hidden="true">↔</span></span>
    <span className="ra-carousel-count" aria-live="polite">{position.index+1} / {items.length}</span>
    <button type="button" className="ra-carousel-arrow" aria-label="Ver opción anterior" aria-controls={trackId} disabled={!position.previous} onClick={()=>go(-1)}>←</button>
    <button type="button" className="ra-carousel-arrow" aria-label="Ver opción siguiente" aria-controls={trackId} disabled={!position.next} onClick={()=>go(1)}>→</button>
  </div>}
 </div>;
}
