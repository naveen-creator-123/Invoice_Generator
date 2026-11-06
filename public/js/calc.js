(function(root){
 const STATE="33";
 /* All money in paise (integers). Shared by browser and server. */
 function calc(d){const intra=(d.pos||STATE)===STATE;let T=0,C=0,S=0,I=0,D=0,Q=0;
  const rows=d.items.map(it=>{const q=+it.qty||0,r=+it.rate||0,dc=Math.round((+it.disc||0)*100),t=Math.round(q*r*100)-dc,g=+it.gst||0;
   const c=intra?Math.round(t*g/200):0,s=intra?Math.round(t*g/200):0,i=intra?0:Math.round(t*g/100);
   T+=t;C+=c;S+=s;I+=i;D+=dc;Q+=q;return{t,c,s,i}});
  const o=Math.round((+d.other||0)*100),raw=T+C+S+I+o,tot=Math.round(raw/100)*100;
  return{rows,T,C,S,I,D,Q,o,ro:tot-raw,tot,intra}}
 if(typeof module!=="undefined")module.exports={calc};else root.calc=calc;
})(typeof window!=="undefined"?window:globalThis);
