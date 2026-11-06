const CHARS="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const inr=p=>(p/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
let view="dash",bills=[],S={},sdraft=null,msg="",draft=null,editing=null,q="",needSetup=false;
async function api(path,opt={}){const r=await fetch("/api"+path,{credentials:"same-origin",headers:{"Content-Type":"application/json"},method:opt.method||"GET",body:opt.body?JSON.stringify(opt.body):undefined});
 if(r.status===401){view="login";draw();throw new Error("auth")}const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Request failed");return j}
const reload=async()=>{[bills,S]=await Promise.all([api("/bills"),api("/settings")])};
const paidP=b=>Math.round((+b.paid||0)*100);
const pstat=b=>paidP(b)>=b.tot?"Paid":paidP(b)>0?"Partial":"Unpaid";

function loginView(){return`<div class="card" style="max-width:360px;margin:40px auto"><h2>${needSetup?"Create administrator":"Administrator login"}</h2><label>Username</label><input id="lu" value="admin"><label>Password${needSetup?" (min 8 characters)":""}</label><input id="lp" type="password" onkeydown="if(event.key==='Enter')doLogin()"><p><button class="btn" onclick="doLogin()">${needSetup?"Create &amp; sign in":"Sign in"}</button></p></div>`}
async function doLogin(){try{await api(needSetup?"/auth/setup":"/auth/login",{method:"POST",body:{username:$("#lu").value,password:$("#lp").value}});needSetup=false;msg="";await reload();view="dash";draw()}catch(e){if(e.message!=="auth"){msg=e.message+" error";draw()}}}
async function logout(){await api("/auth/logout",{method:"POST"}).catch(()=>{});bills=[];view="login";draw()}
async function init(){try{const st=await fetch("/api/auth/status").then(r=>r.json());needSetup=st.setup;if(st.loggedIn){await reload();draw()}else{view="login";draw()}}catch(e){msg="Cannot reach the server. error";draw()}}

function gstOk(g){g=(g||"").toUpperCase();if(!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g))return false;let s=0;for(let i=0;i<14;i++){const v=CHARS.indexOf(g[i])*(i%2?2:1);s+=Math.floor(v/36)+v%36}return CHARS[(36-s%36)%36]===g[14]}
const newItem=()=>({hsn:"",name:"",qty:"",unit:"KGS",rate:"",disc:"0",gst:"5"});
const blank=()=>({no:"",date:new Date().toISOString().slice(0,10),due:"",rname:"",rgstin:"",raddr:"",rphone:"",pos:"",pod:"",other:"0",paid:"0",note:"",items:[newItem()]});

function draw(){
 $("#nav").innerHTML=view==="login"?"":([["dash","Dashboard"],["new","New Invoice"],["list","All Invoices"],["set","Settings"]].map(([k,l])=>`<button class="${view===k?"on":""}" onclick="go('${k}')">${l}</button>`).join("")+'<button onclick="logout()">Logout</button>');
 $("#app").innerHTML=(msg?`<div class="note ${/error/i.test(msg)?"err":""}">${esc(msg.replace(/ error$/,""))}</div>`:"")+({dash,new:form,list,set:settings,login:loginView}[view])()}
function go(v){view=v;if(v==="new"&&!draft){draft=blank();editing=null}if(v==="set")sdraft={...S};if(msg.startsWith("Saved")||msg.startsWith("Deleted")||msg.startsWith("Restored"))msg="";draw()}

function dash(){const m=new Date().toISOString().slice(0,7),sum=k=>bills.reduce((a,b)=>a+(b[k]||0),0),recent=[...bills].sort((a,b)=>b.created-a.created).slice(0,5),
 rec=bills.reduce((a,b)=>a+paidP(b),0),tot=sum("tot");
 return`<div class="grid">${[["Total invoices",bills.length],["Invoice value","₹"+inr(tot)],["Taxable amount","₹"+inr(sum("T"))],["Total GST","₹"+inr(sum("C")+sum("S")+sum("I"))],["This month",bills.filter(b=>(b.date||"").startsWith(m)).length],["Received","₹"+inr(rec)],["Outstanding","₹"+inr(tot-rec)],["Unpaid / partial",bills.filter(b=>pstat(b)!=="Paid").length]].map(([l,v])=>`<div class="card"><div class="mut">${l}</div><div class="stat">${v}</div></div>`).join("")}</div>
 ${S.acc?"":'<div class="card warn">Bank details are not set yet, so they will not print on your invoices. Add them in <a href="#" onclick="go(\'set\');return false">Settings</a>.</div>'}
 <div class="card"><h2>Recent invoices</h2>${recent.length?recent.map(b=>`<div>${esc(b.no)} – ${esc(b.rname)} – ₹${inr(b.tot)} <span class="mut">(${pstat(b)})</span></div>`).join(""):'<span class="mut">No invoices yet.</span>'}<p><button class="btn" onclick="draft=blank();editing=null;go('new')">Create new invoice</button></p></div>`}

function settings(){const d=sdraft;
 const f=(l,k,ex="")=>`<div><label>${l}</label><input ${ex} value="${esc(d[k])}" oninput="sdraft.${k}=this.value"></div>`;
 return`<div class="card"><h2>Business details</h2><div class="grid">${f("Business name *","name")}${f("GSTIN *","gstin",'maxlength="15" style="text-transform:uppercase"')}${f("Address *","addr")}${f("Phone","phone")}${f("Email","email")}</div></div>
 <div class="card"><h2>Bank details (printed on every invoice)</h2><div class="grid">${f("Account holder name","holder")}${f("Bank name","bank")}${f("Account number","acc",'inputmode="numeric"')}${f("IFSC code","ifsc",'maxlength="11" style="text-transform:uppercase" placeholder="e.g. SBIN0001234"')}${f("Branch","branch")}${f("UPI ID (optional)","upi")}</div>
 <div class="mut" style="margin-top:6px">The bank block prints only when an account number is filled in.</div></div>
 <div class="card"><h2>Default terms (printed on every invoice)</h2><input value="${esc(d.terms)}" oninput="sdraft.terms=this.value" placeholder="e.g. Goods once sold will not be taken back"></div>
 <p><button class="btn" onclick="saveSettings()">Save settings</button></p>`}
async function saveSettings(){try{S=await api("/settings",{method:"PUT",body:sdraft});msg="Saved settings.";view="dash";draw()}catch(e){if(e.message!=="auth")err(e.message)}}

function form(){const d=draft,c=calc(d);
 const f=(l,k,t="text",ex="")=>`<div><label>${l}</label><input type="${t}" ${ex} value="${esc(d[k])}" oninput="draft.${k}=this.value;${k==="rgstin"?"autoPos();":""}${k==="pos"?"draft.posTouched=true;":""}upd()"></div>`;
 return`<div class="card"><h2>A · Invoice</h2><div class="grid">${f("Invoice number (manual) *","no")}${f("Invoice date","date","date")}${f("Due date","due","date")}</div></div>
 <div class="card"><h2>B · Seller</h2><b>${esc(S.name)}</b> · ${esc(S.gstin)}<br><span class="mut">${esc(S.addr)}</span></div>
 <div class="card"><h2>C · Buyer</h2><div class="grid">${f("GSTIN","rgstin","text",'maxlength="15" style="text-transform:uppercase"')}${f("Buyer name *","rname")}${f("Address","raddr")}${f("Phone","rphone")}${f("Place of supply (state code)","pos","text",'placeholder="e.g. 33" id="pos"')}${f("Place of delivery","pod")}</div><div id="gv"></div></div>
 <div class="card"><h2>D · Products</h2><div class="tw"><table><thead><tr><th>HSN</th><th>Product</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Discount</th><th>GST %</th><th>Taxable</th><th></th></tr></thead><tbody>
 ${d.items.map((it,i)=>`<tr>${[["hsn"],["name"],["qty",1],["unit"],["rate",1],["disc",1],["gst",1]].map(([k,n])=>`<td><input ${n?'type="number" step="any" min="0"':""} value="${esc(it[k])}" oninput="draft.items[${i}].${k}=this.value;upd()"></td>`).join("")}<td class="r" id="tx${i}">${inr(c.rows[i].t)}</td><td><button class="btn g" onclick="delRow(${i})">✕</button></td></tr>`).join("")}</tbody></table></div>
 <p><button class="btn g" onclick="draft.items.push(newItem());draw()">+ Add product</button></p></div>
 <div class="card"><h2>E · Charges, payment &amp; notes</h2><div class="grid">${f("Other charges ₹","other","number",'min="0" step="any"')}${f("Amount received ₹","paid","number",'min="0" step="any"')}${f("Notes / terms (printed)","note")}</div></div>
 <div class="card"><h2>Summary</h2><div id="sum">${summary(c,d)}</div><p><button class="btn" onclick="save()">${editing?"Update invoice":"Save invoice"}</button> <button class="btn g" onclick="draft=null;editing=null;go('list')">Cancel</button></p></div>`}
function delRow(i){draft.items.splice(i,1);if(!draft.items.length)draft.items.push(newItem());draw()}
function summary(c,d){const bal=c.tot-Math.round((+d.paid||0)*100);return`<div class="grid"><div>Quantity: ${c.Q}</div><div>Taxable: ₹${inr(c.T)}</div>${c.intra?`<div>CGST: ₹${inr(c.C)}</div><div>SGST: ₹${inr(c.S)}</div>`:`<div>IGST: ₹${inr(c.I)}</div>`}<div>Other: ₹${inr(c.o)}</div><div>Round off: ₹${inr(c.ro)}</div><div class="stat">Total ₹${inr(c.tot)}</div><div>Balance due: ₹${inr(bal)}</div></div>`}
function autoPos(){const g=(draft.rgstin||"").toUpperCase();if(/^\d{2}/.test(g)&&!draft.posTouched){draft.pos=g.slice(0,2);const p=$("#pos");if(p)p.value=draft.pos}
 $("#gv").innerHTML=g.length===15?(gstOk(g)?'<span class="mut">GSTIN format and checksum valid</span>':'<span style="color:#b00">GSTIN looks invalid – check it</span>'):""}
function upd(){if(!draft)return;const c=calc(draft);c.rows.forEach((r,i)=>{const e=$("#tx"+i);if(e)e.textContent=inr(r.t)});const s=$("#sum");if(s)s.innerHTML=summary(c,draft)}
function err(m){msg=m+" error";window.scrollTo(0,0);draw()}

async function save(){const d=draft;d.no=d.no.trim();
 if(!d.no)return err("Invoice number is required.");
 if(!d.rname.trim())return err("Buyer name is required.");
 if(!d.items.some(i=>+i.qty>0&&+i.rate>0))return err("Add at least one product with quantity and rate.");
 if(Math.round((+d.paid||0)*100)>calc(d).tot)return err("Amount received cannot exceed the invoice total.");
 try{await api("/bills"+(editing?"/"+encodeURIComponent(editing):""),{method:editing?"PUT":"POST",body:d});await reload();msg="Saved invoice "+d.no+".";draft=null;editing=null;view="list";draw()}catch(e){if(e.message!=="auth")err(e.message)}}

function list(){const t=q.toLowerCase(),L=bills.filter(b=>!t||[b.no,b.rname,b.rgstin].join(" ").toLowerCase().includes(t)).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||b.created-a.created);
 return`<div class="card"><input placeholder="Search by bill no, recipient or GSTIN" value="${esc(q)}" oninput="q=this.value;clearTimeout(window._t);window._t=setTimeout(()=>{draw();const i=document.querySelector('input[placeholder^=Search]');i.focus();i.setSelectionRange(99,99)},250)">
 <p style="margin-bottom:0"><button class="btn g" onclick="exportCsv()">Export CSV</button> <button class="btn g" onclick="exportData()">Download backup</button> <button class="btn g" onclick="$('#imp').click()">Restore backup</button><input id="imp" type="file" accept=".json" style="display:none" onchange="importData(this.files[0])"></p></div>
 <div class="card tw">${L.length?`<table><thead><tr><th>Invoice no</th><th>Date</th><th>Recipient</th><th>Amount</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>${L.map(b=>`<tr><td>${esc(b.no)}</td><td>${esc(b.date)}</td><td>${esc(b.rname)}</td><td class="r">₹${inr(b.tot)}</td><td class="r">₹${inr(b.tot-paidP(b))}</td><td>${pstat(b)}</td><td style="white-space:nowrap"><button class="btn g" onclick="pr('${b.id}')">Print</button> <button class="btn g" onclick="ed('${b.id}')">Edit</button> <button class="btn g" onclick="del('${b.id}')">Delete</button></td></tr>`).join("")}</tbody></table>`:'<span class="mut">No invoices found.</span>'}</div>`}
function ed(id){draft=JSON.parse(JSON.stringify(bills.find(b=>b.id===id)));editing=id;view="new";draw();autoPos()}
async function del(id){const b=bills.find(x=>x.id===id);if(!confirm("Delete invoice "+b.no+"? This cannot be undone."))return;
 try{await api("/bills/"+encodeURIComponent(id),{method:"DELETE"});await reload();msg="Deleted invoice "+b.no+".";draw()}catch(e){if(e.message!=="auth")err(e.message)}}
function download(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click()}
const today=()=>new Date().toISOString().slice(0,10);
function exportData(){download("naveen-tex-bills-"+today()+".json",JSON.stringify(bills,null,1),"application/json")}
function exportCsv(){const cell=v=>'"'+String(v??"").replace(/"/g,'""')+'"',h=["Invoice no","Date","Buyer","GSTIN","Taxable","CGST","SGST","IGST","Total","Received","Balance"],
 rows=[...bills].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(b=>[b.no,b.date,b.rname,b.rgstin,b.T,b.C,b.S,b.I,b.tot,paidP(b),b.tot-paidP(b)].map((v,i)=>i>3?(v/100).toFixed(2):v));
 download("naveen-tex-invoices-"+today()+".csv","\ufeff"+[h,...rows].map(r=>r.map(cell).join(",")).join("\r\n"),"text/csv")}
function importData(f){if(!f)return;const r=new FileReader();r.onload=()=>{try{const a=JSON.parse(r.result);if(!Array.isArray(a)||a.some(x=>!x.id||!x.no))throw 0;
 if(!confirm("Restore "+a.length+" invoices? Bills with the same number will be replaced."))return;
 api("/restore",{method:"POST",body:a}).then(reload).then(()=>{msg="Restored "+a.length+" invoices.";draw()}).catch(e=>e.message!=="auth"&&err(e.message))}catch(e){err("That file is not a valid backup.")}};r.readAsText(f)}

/* Printing: render into a hidden iframe so it works in any browser and prints only the bill. */
const PRINT_CSS=`@page{size:A4;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{width:100%}body{font:11px/1.45 Arial,sans-serif;color:#111;margin:0}
.sheet{border:2px solid #c4161c;padding:0}table{width:100%;border-collapse:collapse}td,th{padding:4px 6px;vertical-align:top}
.head td{vertical-align:middle;padding:8px 10px}.logo{width:92px}.logo img{width:80px;height:auto;display:block}
.bname{font-size:26px;font-weight:bold;color:#c4161c;letter-spacing:2px;text-align:center}.bsub{text-align:center;font-size:11px;margin-top:2px}
.title{background:#c4161c;color:#fff;text-align:center;font-weight:bold;letter-spacing:3px;font-size:13px;padding:4px}
.two td{border-top:1px solid #c4161c;width:50%}.two td+td{border-left:1px solid #c4161c}
.lab{color:#c4161c;font-weight:bold;font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px}
.items{border-top:1px solid #c4161c}.items th{background:#fff6c2;border-bottom:1px solid #c4161c;border-right:1px solid #e3c96a;text-align:left;font-size:10.5px}
.items td{border-bottom:1px solid #ddd;border-right:1px solid #eee}.items th:last-child,.items td:last-child{border-right:0}
.items tr.fill td{height:20px}thead{display:table-header-group}tr{page-break-inside:avoid}.r{text-align:right}
.foot td{border-top:1px solid #c4161c}.foot td+td{border-left:1px solid #c4161c}
.tot td{padding:3px 6px;border:0}.tot tr.g td{background:#fff6c2;font-size:13px;font-weight:bold;border-top:1px solid #c4161c;border-bottom:1px solid #c4161c}
.bank td{padding:1px 4px 1px 0}.sig{height:64px;vertical-align:bottom;text-align:right}small{color:#444}`;
function words(n){const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],b=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
 const t=n=>n<20?a[n]:b[Math.floor(n/10)]+(n%10?" "+a[n%10]:""),h=n=>(n>99?a[Math.floor(n/100)]+" Hundred"+(n%100?" ":""):"")+(n%100?t(n%100):"");
 if(!n)return"Zero";let r="";const cr=Math.floor(n/1e7),l=Math.floor(n%1e7/1e5),th=Math.floor(n%1e5/1e3),rest=n%1e3;
 if(cr)r+=h(cr)+" Crore ";if(l)r+=h(l)+" Lakh ";if(th)r+=h(th)+" Thousand ";if(rest)r+=h(rest);return r.trim()}
function pr(id){const b=bills.find(x=>x.id===id),c=calc(b),total=c.tot/100,bal=c.tot-paidP(b),
 tr=(a,v,cls="")=>`<tr class="${cls}"><td>${a}</td><td class="r">${v}</td></tr>`,bk=(a,v)=>`<tr><td>${a}</td><td>: <b>${v}</b></td></tr>`,
 terms=[S.terms,b.note].filter(Boolean).map(esc).join("<br>"),minRows=Math.max(0,8-b.items.length);
 const html=`<div class="sheet">
 <table class="head"><tr><td class="logo"><img src="img/logo.png" alt=""></td><td style="padding-right:102px"><div class="bname">${esc(S.name)}</div><div class="bsub">${esc(S.addr)}</div><div class="bsub">GSTIN: <b>${esc(S.gstin)}</b>${S.phone?" &nbsp;|&nbsp; Phone: "+esc(S.phone):""}${S.email?" &nbsp;|&nbsp; "+esc(S.email):""}</div></td></tr></table>
 <div class="title">TAX INVOICE</div>
 <table class="two"><tr><td><div class="lab">Bill To</div><b style="font-size:12px">${esc(b.rname)}</b><br>${esc(b.raddr)}${b.rphone?"<br>Phone: "+esc(b.rphone):""}<br>GSTIN: ${esc(b.rgstin||"–")}</td>
 <td><div class="lab">Invoice Details</div><table style="margin:0"><tr><td style="padding:0;width:42%">Invoice No</td><td style="padding:0">: <b>${esc(b.no)}</b></td></tr><tr><td style="padding:0">Date</td><td style="padding:0">: ${esc(b.date)}</td></tr>${b.due?`<tr><td style="padding:0">Due date</td><td style="padding:0">: ${esc(b.due)}</td></tr>`:""}<tr><td style="padding:0">Place of supply</td><td style="padding:0">: ${esc(b.pos||S.gstin.slice(0,2))}</td></tr><tr><td style="padding:0">Place of delivery</td><td style="padding:0">: ${esc(b.pod||"–")}</td></tr></table></td></tr></table>
 <table class="items"><thead><tr><th>#</th><th>Description</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Disc ₹</th><th class="r">Taxable ₹</th><th class="r">GST %</th><th class="r">Amount ₹</th></tr></thead><tbody>
 ${b.items.map((it,i)=>{const r=c.rows[i];return`<tr><td>${i+1}</td><td>${esc(it.name)}</td><td>${esc(it.hsn)}</td><td class="r">${esc(it.qty)} ${esc(it.unit)}</td><td class="r">${esc(it.rate)}</td><td class="r">${esc(it.disc||0)}</td><td class="r">${inr(r.t)}</td><td class="r">${esc(it.gst)}</td><td class="r">${inr(r.t+r.c+r.s+r.i)}</td></tr>`}).join("")}
 ${Array.from({length:minRows},()=>'<tr class="fill"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join("")}</tbody></table>
 <table class="foot"><tr><td style="width:56%"><div class="lab">Amount in words</div>Rupees ${words(total)} Only
 ${S.acc?`<div class="lab" style="margin-top:8px">Bank Details</div><table class="bank">${bk("Bank",esc(S.bank))}${bk("Branch",esc(S.branch))}${bk("A/c No",esc(S.acc))}${bk("IFSC Code",esc(S.ifsc))}${S.holder?bk("A/c Holder",esc(S.holder)):""}${S.upi?bk("UPI ID",esc(S.upi)):""}</table>`:""}
 ${terms?`<div class="lab" style="margin-top:8px">Terms / notes</div>${terms}`:""}</td>
 <td style="padding:0"><table class="tot">${tr("Total taxable","₹"+inr(c.T))}${c.intra?tr("CGST","₹"+inr(c.C))+tr("SGST","₹"+inr(c.S)):tr("IGST","₹"+inr(c.I))}${c.o?tr("Other charges","₹"+inr(c.o)):""}${tr("Round off","₹"+inr(c.ro))}${tr("TOTAL","₹"+inr(c.tot),"g")}${paidP(b)?tr("Received","₹"+inr(paidP(b)))+tr("<b>Balance due</b>","<b>₹"+inr(bal)+"</b>"):""}</table></td></tr></table>
 <table class="foot"><tr><td style="width:56%"><small>Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</small></td><td class="sig">For <b>${esc(S.name)}</b><br><br>Authorised Signatory</td></tr></table></div>`;
 const f=document.createElement("iframe");f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0";document.body.appendChild(f);
 const w=f.contentWindow;w.document.open();w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(b.no)}</title><base href="${location.origin}/"><style>${PRINT_CSS}</style></head><body>${html}</body></html>`);w.document.close();
 const go=()=>{try{w.focus();w.print()}catch(e){err("Printing failed: "+e.message)}setTimeout(()=>f.remove(),2000)},im=new Image();im.onload=im.onerror=()=>setTimeout(go,200);im.src="img/logo.png"}
init();
