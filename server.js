/* Naveen Tex Invoice Generator - Express app for Vercel (exported) and local run (node server.js).
   Env vars: DATABASE_URL (Postgres/Neon), SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD */
const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const { calc } = require("./public/js/calc.js");
const DEF={name:"NAVEEN TEX",gstin:"33BJEPM7823D2ZE",addr:"3/178/4, Saravana Nagar, Chennimalai, Erode, Tamil Nadu 638051",phone:"",email:"",holder:"",bank:"Tamilnadu Mercantile Bank",acc:"361700050900039",ifsc:"TMBL0000361",branch:"Kanakkankadu (CHENNIMALAI)",upi:"",terms:""};
const pool=new Pool({connectionString:process.env.DATABASE_URL||process.env.POSTGRES_URL,max:3,idleTimeoutMillis:10000});
let ready=null;
const init=()=>ready||(ready=pool.query(`
 CREATE TABLE IF NOT EXISTS bills(id TEXT PRIMARY KEY,no TEXT NOT NULL UNIQUE,date TEXT,rname TEXT,rgstin TEXT,tot BIGINT,data JSONB NOT NULL,created BIGINT,updated BIGINT);
 CREATE INDEX IF NOT EXISTS i_bills_date ON bills(date);
 CREATE TABLE IF NOT EXISTS settings(id INT PRIMARY KEY CHECK(id=1),data JSONB NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts(ip TEXT PRIMARY KEY,c INT NOT NULL,t BIGINT NOT NULL);`).catch(e=>{ready=null;throw e}));

/* ---- auth: credentials from env vars, signed stateless cookie (works across serverless instances) ---- */
const TTL=12*3600e3,SECRET=()=>{if(!process.env.SESSION_SECRET)throw new Error("SESSION_SECRET is not set");return process.env.SESSION_SECRET};
const sign=p=>crypto.createHmac("sha256",SECRET()).update(p).digest("base64url");
const cookie=req=>Object.fromEntries((req.headers.cookie||"").split(";").map(c=>c.trim().split("=")).filter(c=>c[0]));
const same=(a,b)=>{const x=crypto.createHash("sha256").update(String(a)).digest(),y=crypto.createHash("sha256").update(String(b)).digest();return crypto.timingSafeEqual(x,y)};
const loggedIn=req=>{const t=cookie(req).sid;if(!t)return false;const[p,s]=t.split(".");if(!p||!s||!same(s,sign(p)))return false;return+p>Date.now()};
const secure=process.env.VERCEL||process.env.NODE_ENV==="production"?"; Secure":"";
const startSession=res=>{const p=String(Date.now()+TTL);res.setHeader("Set-Cookie",`sid=${p}.${sign(p)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL/1000}${secure}`)};
const ip=req=>String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"x").split(",")[0].trim();
async function limited(req){const k=ip(req),now=Date.now();
 const r=await pool.query(`INSERT INTO attempts(ip,c,t) VALUES($1,1,$2) ON CONFLICT(ip) DO UPDATE SET c=CASE WHEN $2-attempts.t>900000 THEN 1 ELSE attempts.c+1 END,t=CASE WHEN $2-attempts.t>900000 THEN $2 ELSE attempts.t END RETURNING c`,[k,now]);return r.rows[0].c>8}
const needAuth=(req,res,next)=>loggedIn(req)?next():res.status(401).json({error:"Not signed in"});
const w=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(e=>{console.error(e);res.status(500).json({error:"Server error: "+e.message})});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));
app.use((req,res,next)=>{res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Frame-Options","DENY");next()});
app.use("/api",w(async(req,res,next)=>{await init();next()}));
app.get("/api/auth/status",(req,res)=>res.json({setup:false,loggedIn:loggedIn(req)}));
app.post("/api/auth/login",w(async(req,res)=>{
 if(!process.env.ADMIN_USERNAME||!process.env.ADMIN_PASSWORD)return res.status(500).json({error:"ADMIN_USERNAME / ADMIN_PASSWORD are not set on the server"});
 if(await limited(req))return res.status(429).json({error:"Too many attempts. Try again in 15 minutes."});
 const{username,password}=req.body||{};
 if(!username||!password||!same(username,process.env.ADMIN_USERNAME)|!same(password,process.env.ADMIN_PASSWORD))return res.status(400).json({error:"Invalid username or password"});
 await pool.query("DELETE FROM attempts WHERE ip=$1",[ip(req)]);startSession(res);res.json({ok:true})}));
app.post("/api/auth/logout",(req,res)=>{res.setHeader("Set-Cookie",`sid=; HttpOnly; Path=/; Max-Age=0${secure}`);res.json({ok:true})});

/* ---- bills ---- */
const bid=n=>"b_"+String(n).replace(/[^A-Za-z0-9_.-]/g,"_");
function validate(d){
 if(!d||typeof d!=="object")return"Invalid bill";d.no=String(d.no||"").trim();
 if(!d.no||d.no.length>40)return"Invoice number is required";if(!String(d.rname||"").trim())return"Buyer name is required";
 if(!Array.isArray(d.items)||!d.items.length||d.items.length>200)return"Add between 1 and 200 products";
 if(!d.items.some(i=>+i.qty>0&&+i.rate>0))return"Add at least one product with quantity and rate";
 if(d.items.some(i=>+i.qty<0||+i.rate<0||+i.disc<0||+i.gst<0||+i.gst>100))return"Quantity, rate, discount and GST must be valid positive numbers";
 if(+d.paid<0)return"Amount received cannot be negative";
 if(Math.round((+d.paid||0)*100)>calc(d).tot)return"Amount received cannot exceed the invoice total";return null}
const LEGACY=["ebn","vf","vu","mode","km","veh","supply","type","status","biz","posTouched"];
function build(d,old){const c=calc(d),id=bid(d.no),now=Date.now();
 const rec={...d,id,T:c.T,C:c.C,S:c.S,I:c.I,tot:c.tot,paid:String(+d.paid||0),due:String(d.due||""),rphone:String(d.rphone||""),created:old?old.created:(+d.created||now),updated:now};
 LEGACY.forEach(k=>delete rec[k]);return rec}
const UPSERT=`INSERT INTO bills(id,no,date,rname,rgstin,tot,data,created,updated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
 ON CONFLICT(id) DO UPDATE SET no=EXCLUDED.no,date=EXCLUDED.date,rname=EXCLUDED.rname,rgstin=EXCLUDED.rgstin,tot=EXCLUDED.tot,data=EXCLUDED.data,updated=EXCLUDED.updated`;
const vals=r=>[r.id,r.no,r.date||"",r.rname,r.rgstin||"",r.tot,JSON.stringify(r),r.created,r.updated];
const get=async id=>{const r=await pool.query("SELECT data FROM bills WHERE id=$1",[id]);return r.rows[0]&&r.rows[0].data};
async function tx(fn){const c=await pool.connect();try{await c.query("BEGIN");await fn(c);await c.query("COMMIT")}catch(e){await c.query("ROLLBACK").catch(()=>{});throw e}finally{c.release()}}

app.get("/api/bills",needAuth,w(async(req,res)=>{const r=await pool.query("SELECT data FROM bills ORDER BY date DESC,created DESC");res.json(r.rows.map(x=>x.data))}));
app.post("/api/bills",needAuth,w(async(req,res)=>{const e=validate(req.body);if(e)return res.status(400).json({error:e});
 const rec=build(req.body);if(await get(rec.id))return res.status(400).json({error:"Invoice number "+rec.no+" already exists"});
 await pool.query(UPSERT,vals(rec));res.json(rec)}));
app.put("/api/bills/:id",needAuth,w(async(req,res)=>{const old=await get(req.params.id);if(!old)return res.status(404).json({error:"Bill not found"});
 const e=validate(req.body);if(e)return res.status(400).json({error:e});const rec=build(req.body,old);
 if(rec.id!==old.id&&await get(rec.id))return res.status(400).json({error:"Invoice number "+rec.no+" already exists"});
 await tx(async c=>{if(rec.id!==old.id)await c.query("DELETE FROM bills WHERE id=$1",[old.id]);await c.query(UPSERT,vals(rec))});res.json(rec)}));
app.delete("/api/bills/:id",needAuth,w(async(req,res)=>{const old=await get(req.params.id);if(!old)return res.status(404).json({error:"Bill not found"});
 await pool.query("DELETE FROM bills WHERE id=$1",[old.id]);res.json({ok:true})}));
app.post("/api/restore",needAuth,w(async(req,res)=>{const a=req.body;if(!Array.isArray(a)||a.length>5000)return res.status(400).json({error:"Invalid backup"});
 for(const d of a){const e=validate(d);if(e)return res.status(400).json({error:"Bill "+(d&&d.no)+": "+e})}
 await tx(async c=>{for(const d of a)await c.query(UPSERT,vals(build(d,{created:+d.created||Date.now()})))});res.json({ok:true})}));

/* ---- settings ---- */
app.get("/api/settings",needAuth,w(async(req,res)=>{const r=await pool.query("SELECT data FROM settings WHERE id=1"),o={...DEF,...(r.rows[0]?r.rows[0].data:{})};
 if(!o.acc)["bank","acc","ifsc","branch"].forEach(k=>o[k]=DEF[k]);res.json(o)}));
app.put("/api/settings",needAuth,w(async(req,res)=>{const b=req.body||{},o={};
 for(const k of Object.keys(DEF))o[k]=String(b[k]??"").trim().slice(0,k==="terms"?500:200);
 o.ifsc=o.ifsc.toUpperCase();o.gstin=o.gstin.toUpperCase();
 if(!o.name)return res.status(400).json({error:"Business name is required"});
 if(!o.addr)return res.status(400).json({error:"Business address is required"});
 if(!/^\d{2}/.test(o.gstin))return res.status(400).json({error:"GSTIN must start with the 2-digit state code"});
 if(o.ifsc&&!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(o.ifsc))return res.status(400).json({error:"IFSC code looks invalid (example: SBIN0001234)"});
 if(o.acc&&!/^\d{6,20}$/.test(o.acc))return res.status(400).json({error:"Account number should be digits only"});
 await pool.query("INSERT INTO settings(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",[JSON.stringify(o)]);res.json(o)}));

/* ---- web pages: read once at start-up. Each file is listed with a literal path so Vercel bundles it with the function. ---- */
const PAGES = {
  "/index.html": ["text/html; charset=utf-8", fs.readFileSync(path.join(__dirname, "public", "index.html"))],
  "/css/style.css": ["text/css; charset=utf-8", fs.readFileSync(path.join(__dirname, "public", "css", "style.css"))],
  "/js/app.js": ["application/javascript; charset=utf-8", fs.readFileSync(path.join(__dirname, "public", "js", "app.js"))],
  "/js/calc.js": ["application/javascript; charset=utf-8", fs.readFileSync(path.join(__dirname, "public", "js", "calc.js"))],
  "/img/logo.png": ["image/png", fs.readFileSync(path.join(__dirname, "public", "img", "logo.png"))],
};
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  const p = PAGES[req.path === "/" ? "/index.html" : req.path];
  if (!p) return next();
  res.set("Cache-Control", "no-cache").type(p[0]).send(p[1]);
});
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log("Naveen Tex Invoice Generator on http://localhost:" + PORT));
}

module.exports = app;
