/* Shared semantic recognizer: used by the simulator (browser) and by the learning engine (Netlify functions).
   It maps what an agent MEANS (not the exact words) to the verification field being asked for. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Sem=factory()})(typeof self!=='undefined'?self:this,function(){
 const STOP=new Set('a an the is are am was were do does did you your yours i me my mine may can could would will shall please kindly tell give provide have has had so just now it its this that there if and or to of for in on at with be been being out up us we our let know like want need would s ll re ve d t also then than as by about any some which what'.split(' '));
 const SYN={flying:'fly',flies:'fly',flew:'fly',flown:'fly',flight:'fly',journey:'trip',trip:'trip',travel:'trip',travelling:'trip',traveling:'trip',travels:'trip',leave:'depart',leaving:'depart',leaves:'depart',left:'depart',departing:'depart',departure:'depart',departs:'depart',depart:'depart',start:'depart',starts:'depart',starting:'depart',started:'depart',begin:'depart',begins:'depart',beginning:'depart',began:'depart',originate:'depart',originating:'depart',origin:'depart',takeoff:'depart',off:'depart',
  headed:'go',heading:'go',going:'go',go:'go',goes:'go',destination:'arrive',arrive:'arrive',arriving:'arrive',arrives:'arrive',arrival:'arrive',land:'arrive',landing:'arrive',lands:'arrive',end:'arrive',ends:'arrive',ending:'arrive',final:'arrive',
  city:'place',airport:'place',location:'place',town:'place',place:'place',
  day:'date',date:'date',dated:'date',scheduled:'date',schedule:'date',when:'when',whens:'when',
  reservation:'booking',booking:'booking',booked:'booking',confirmation:'ref',confirm:'ref',confirmed:'ref',reference:'ref',code:'ref',pnr:'ref',locator:'ref',number:'ref',
  complete:'full',full:'full',whole:'full',surname:'name',lastname:'name',firstname:'name',name:'name',speaking:'name',talking:'name',who:'name',
  passengers:'pax',passenger:'pax',travelers:'pax',travellers:'pax',people:'pax',adults:'pax',persons:'pax',many:'many',
  luggage:'bag',baggage:'bag',bags:'bag',bag:'bag',suitcase:'bag',suitcases:'bag',checked:'bag',
  old:'age',age:'age',birthday:'age',birth:'age',born:'age',
  phone:'contact',email:'contact',mobile:'contact',contact:'contact',reach:'contact'};
 const STEM=w=>w.length>4?w.replace(/(ing|ed|es|s)$/,''):w;
 function tokens(t){return String(t||'').toLowerCase().replace(/\bout of\b/g,' from ').replace(/[\u2019']/g,'').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean).map(w=>SYN[w]||SYN[STEM(w)]||STEM(w)).filter(w=>!STOP.has(w))}
 const SEEDS={
  origin:['where will your trip start','where does your journey begin','which city are you flying out of','what is your departure city','where are you departing from','where are you flying from','which airport will you leave from','where is your flight starting from','what airport are you departing from','where does your flight originate'],
  dest:['where are you headed','where are you going','what is your destination','which city will you arrive in','where is your trip ending','what is your arrival city','where do you want to go','where will you land','which airport are you flying to','where is your flight going'],
  date:['when is your scheduled flight','what day are you traveling','what is your travel date','which day do you fly','what date is your flight','when are you departing','on what date are you traveling','what is the date of your trip'],
  name:['who am i speaking with','may i have your complete name','what is your full name','what is the name of the passenger','your name please','may i know the name on the booking'],
  bkref:['can you provide your booking confirmation','what is your confirmation code','reservation number please','what is your booking reference','do you have your record locator','may i have the pnr'],
  pax:['how many passengers are traveling','how many people are flying','how many travelers','how many are in your party'],
  bags:['do you have checked luggage','how many bags are you bringing','are you checking any baggage','how many suitcases do you have'],
  age:['how old are you','what is your age','when is your birthday','what is the passenger age'],
  contact:['what is the best phone number','can i have an email address','how can we reach you','what is your contact number']};
 const ANCHOR={origin:/^(depart|from)$/,dest:/^(arrive|go)$/,date:/^(date|when)$/,name:/^(name)$/,bkref:/^(ref|booking)$/,pax:/^(pax)$/,bags:/^(bag)$/,age:/^(age)$/,contact:/^(contact)$/};
 let learned={};
 const seedTok=()=>{const o={};for(const k in SEEDS)o[k]=SEEDS[k].map(s=>({s,t:new Set(tokens(s))}));for(const k in learned){(o[k]=o[k]||[]);learned[k].forEach(s=>o[k].push({s,t:new Set(tokens(s))}))}return o};
 function dice(a,b){if(!a.size||!b.size)return 0;let n=0;a.forEach(x=>{if(b.has(x))n++});return 2*n/(a.size+b.size)}
 function sentences(t){return String(t||'').split(/(?<=[.?!])\s+|\n+/).map(z=>z.trim()).filter(Boolean)}
 function classify(text){const S=seedTok(),tk=new Set(tokens(text));if(!tk.size)return{field:null,score:0};let best={field:null,score:0,seed:''};
  for(const k in S){const anch=ANCHOR[k];const has=anch?[...tk].some(x=>anch.test(x)):true;if(!has)continue;for(const sd of S[k]){const sc=dice(tk,sd.t);if(sc>best.score)best={field:k,score:sc,seed:sd.s}}}
  return best.score>=0.6?best:{field:null,score:best.score}}
 function topics(text,minScore){const out=[];sentences(text).forEach(s=>{const c=classify(s);if(c.field&&c.score>=(minScore||0.6)&&!out.includes(c.field))out.push(c.field)});return out}
 return{tokens,classify,topics,sentences,SEEDS,setLearned:o=>{learned=o||{}},getLearned:()=>learned,dice,STOP}});
