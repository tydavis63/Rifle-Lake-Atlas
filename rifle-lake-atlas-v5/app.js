const LAKE_CENTER=[44.4085833,-83.9797917];
const DEFAULT_BOUNDS={north:44.4200,south:44.4000,west:-83.9900,east:-83.9700};
const CONTOUR_URL='https://gisagocss.state.mi.us/arcgis/rest/services/OpenData/hydro/MapServer/4/query?where=1%3D1&geometry=-83.995%2C44.395%2C-83.965%2C44.43&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=DEPTH%2COBJECTID&returnGeometry=true&outSR=4326&f=geojson';
let bounds=JSON.parse(localStorage.getItem('rifleBounds')||'null')||{...DEFAULT_BOUNDS};
let weatherState=null,gpsWatch=null,gpsMarker=null,gpsCircle=null,followGps=false;

const map=L.map('map',{zoomControl:true}).setView(LAKE_CENTER,14);
const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri imagery'});
let imageOverlay=L.imageOverlay('assets/rifle-lake-user-map.jpg',[[bounds.south,bounds.west],[bounds.north,bounds.east]],{opacity:.82,interactive:false}).addTo(map);
const stateContours=L.geoJSON(null,{style:f=>({color:'#70c8ef',weight:Number(f.properties?.DEPTH||0)%10===0?2.2:1,opacity:.9}),onEachFeature:(f,l)=>{if(f.properties?.DEPTH!=null)l.bindTooltip(`${f.properties.DEPTH} ft`,{className:'depth-label'});}});
const recommendations=L.layerGroup().addTo(map);

const areas=[
{name:'North basin weed edge',lat:44.4178,lng:-83.9811,depth:'8–16 ft',first:'Walking bait or spybait',follow:'Drop shot',tags:['morning','calm','north','shallow']},
{name:'Northwest inside turn',lat:44.4162,lng:-83.9852,depth:'10–18 ft',first:'Ned rig',follow:'Finesse jig',tags:['cloud','west','finesse']},
{name:'North basin east point',lat:44.4159,lng:-83.9754,depth:'8–15 ft',first:'Swim jig or chatterbait',follow:'Jerkbait',tags:['wind','east','moving']},
{name:'Narrows north lip',lat:44.4133,lng:-83.9808,depth:'10–22 ft',first:'Small swimbait',follow:'Drop shot',tags:['all','narrows','deep']},
{name:'Narrows south lip',lat:44.4114,lng:-83.9802,depth:'8–18 ft',first:'Spybait',follow:'Tube',tags:['morning','narrows','finesse']},
{name:'West mid-lake point',lat:44.4093,lng:-83.9851,depth:'10–20 ft',first:'Football jig',follow:'Drop shot',tags:['sun','west','deep']},
{name:'East mid-lake break',lat:44.4082,lng:-83.9748,depth:'12–24 ft',first:'Drop shot',follow:'Finesse swimbait',tags:['sun','east','deep']},
{name:'Southwest shelf',lat:44.4055,lng:-83.9843,depth:'7–15 ft',first:'Topwater',follow:'Weightless fluke',tags:['morning','west','shallow']},
{name:'South basin deep edge',lat:44.4029,lng:-83.9797,depth:'15–28 ft',first:'Drop shot',follow:'Jig worm',tags:['sun','deep']},
{name:'Southeast point',lat:44.4050,lng:-83.9742,depth:'8–18 ft',first:'Chatterbait',follow:'Ned rig',tags:['wind','east','evening']}
];

function compass(deg){return ['N','NE','E','SE','S','SW','W','NW'][Math.round((deg||0)/45)%8];}
function scoreAreas(){
  const h=new Date().getHours(),wind=weatherState?.windSpeed||0,dir=weatherState?.windDir||0,cloud=weatherState?.cloud||0;
  return areas.map(a=>{let s=0;
    if(h<9&&a.tags.includes('morning'))s+=4;if(h>=9&&h<17&&a.tags.includes('sun'))s+=cloud<55?3:1;if(h>=17&&a.tags.includes('evening'))s+=4;
    if(cloud>60&&a.tags.includes('cloud'))s+=3;if(wind>7&&a.tags.includes('wind'))s+=4;if(wind<6&&a.tags.includes('calm'))s+=3;
    if(dir>=225&&dir<=315&&a.tags.includes('east'))s+=3;if(dir>=45&&dir<=135&&a.tags.includes('west'))s+=3;
    if(wind>12&&a.tags.includes('narrows'))s+=2;if(h>=10&&a.tags.includes('deep'))s+=2;
    return {...a,score:s};}).sort((a,b)=>b.score-a.score).slice(0,3);
}
function drawRecommendations(top){recommendations.clearLayers();const labels=['START','NEXT','BACKUP'];top.forEach((a,i)=>{const cls=i===1?'secondary':i===2?'backup':'';L.circle([a.lat,a.lng],{radius:i===0?115:90,color:i===0?'#65c7b0':i===1?'#d8e4e8':'#f3c968',weight:3,fillOpacity:.14}).addTo(recommendations).bindPopup(`<strong>${labels[i]}: ${a.name}</strong><br>${a.depth}<br>${a.first}<br>Follow-up: ${a.follow}`);L.marker([a.lat,a.lng],{icon:L.divIcon({className:'recommend-label',html:`<span class="recommend-chip ${cls}">${labels[i]}</span>`,iconAnchor:[28,15]})}).addTo(recommendations);});}
function renderPlan(){const top=scoreAreas();if(!top.length)return;drawRecommendations(top);const p=top[0];const wind=weatherState?`${compass(weatherState.windDir)} ${Math.round(weatherState.windSpeed)} mph`:'current wind';document.getElementById('planHeadline').textContent=`Start on ${p.name}`;document.getElementById('startArea').textContent=p.name;document.getElementById('targetDepth').textContent=p.depth;document.getElementById('firstBait').textContent=p.first;document.getElementById('followBait').textContent=p.follow;document.getElementById('planReason').textContent=`Best current fit for ${wind}, ${weatherState?.cloud??'—'}% cloud cover, and this time of day. Fish the highlighted START area first, then move to NEXT if there is no activity.`;document.getElementById('rankedAreas').innerHTML=top.map((a,i)=>`<div class="area-card"><strong>${['1. Start','2. Next','3. Backup'][i]} — ${a.name}</strong><span>${a.depth} • ${a.first} → ${a.follow}</span><button type="button" data-area="${areas.findIndex(x=>x.name===a.name)}">Show on map</button></div>`).join('');document.querySelectorAll('[data-area]').forEach(b=>b.addEventListener('click',()=>{const a=areas[+b.dataset.area];map.setView([a.lat,a.lng],16);}));}

async function refreshWeather(){
  const url='https://api.open-meteo.com/v1/forecast?latitude=44.4086&longitude=-83.9798&current=temperature_2m,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7';
  try{const r=await fetch(url);if(!r.ok)throw new Error('weather');const d=await r.json(),c=d.current;weatherState={air:c.temperature_2m,cloud:c.cloud_cover,rain:c.precipitation,windSpeed:c.wind_speed_10m,windDir:c.wind_direction_10m,daily:d.daily};document.getElementById('air').textContent=`${Math.round(c.temperature_2m)}°F`;document.getElementById('wind').textContent=`${compass(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)} mph`;document.getElementById('clouds').textContent=`${Math.round(c.cloud_cover)}%`;document.getElementById('rain').textContent=`${c.precipitation.toFixed(2)} in`;estimateWater(d);renderPlan();windControl.getContainer().textContent=`Wind ${compass(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)} mph`;}catch(e){document.getElementById('planHeadline').textContent='Weather unavailable — use seasonal plan';renderPlan();}}
function estimateWater(d){const highs=d.daily.temperature_2m_max,lows=d.daily.temperature_2m_min;const avg=highs.reduce((s,v,i)=>s+(v+lows[i])/2,0)/highs.length;const surface=Math.round(avg*.67+24);document.getElementById('surfaceTemp').textContent=`${surface}°F`;document.getElementById('weedTemp').textContent=`${surface-1}–${surface+1}°F`;document.getElementById('edgeTemp').textContent=`${surface-5}–${surface-2}°F`;document.getElementById('thermo').textContent=surface>70?'14–20 ft':'weak / forming';document.getElementById('confidence').textContent='medium';}

const windControl=L.control({position:'topright'});windControl.onAdd=()=>{const d=L.DomUtil.create('div','leaflet-control wind-control');d.textContent='Wind —';return d};windControl.addTo(map);
document.getElementById('weatherBtn').addEventListener('click',refreshWeather);document.getElementById('refreshPlan').addEventListener('click',refreshWeather);

document.getElementById('opacity').addEventListener('input',e=>{imageOverlay.setOpacity(e.target.value/100);document.getElementById('opacityValue').textContent=`${e.target.value}%`;});
document.getElementById('userMapToggle').addEventListener('change',e=>e.target.checked?imageOverlay.addTo(map):map.removeLayer(imageOverlay));
document.getElementById('satelliteToggle').addEventListener('change',e=>{if(e.target.checked){map.removeLayer(street);satellite.addTo(map);imageOverlay.bringToFront();recommendations.bringToFront();}else{map.removeLayer(satellite);street.addTo(map);imageOverlay.bringToFront();recommendations.bringToFront();}});
document.getElementById('recommendationToggle').addEventListener('change',e=>e.target.checked?recommendations.addTo(map):map.removeLayer(recommendations));
document.getElementById('stateToggle').addEventListener('change',async e=>{if(e.target.checked){if(!stateContours.getLayers().length){document.getElementById('contourStatus').textContent='Loading Michigan reference contours…';try{const r=await fetch(CONTOUR_URL),g=await r.json();stateContours.addData(g);document.getElementById('contourStatus').textContent=`Loaded ${stateContours.getLayers().length} reference lines.`;}catch{document.getElementById('contourStatus').textContent='Could not load Michigan reference contours.';}}stateContours.addTo(map);}else map.removeLayer(stateContours);});
map.on('click',e=>document.getElementById('mapReadout').textContent=`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);

document.getElementById('centerBtn').addEventListener('click',()=>map.fitBounds(imageOverlay.getBounds(),{padding:[16,16]}));document.getElementById('followBtn').addEventListener('click',()=>{followGps=!followGps;document.getElementById('followBtn').textContent=followGps?'Following':'Follow';});
document.getElementById('gpsBtn').addEventListener('click',()=>{if(!navigator.geolocation){alert('GPS is not supported.');return;}if(gpsWatch!=null){navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null;document.getElementById('gpsState').textContent='GPS off';document.getElementById('gpsBtn').textContent='Use GPS';return;}gpsWatch=navigator.geolocation.watchPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude],acc=p.coords.accuracy;if(!gpsMarker){gpsMarker=L.circleMarker(ll,{radius:8,color:'#fff',weight:3,fillColor:'#2477ff',fillOpacity:1}).addTo(map);gpsCircle=L.circle(ll,{radius:acc,color:'#2477ff',weight:1,fillOpacity:.12}).addTo(map);}else{gpsMarker.setLatLng(ll);gpsCircle.setLatLng(ll).setRadius(acc);}document.getElementById('gpsState').textContent=`GPS ±${Math.round(acc*3.28084)} ft`;document.getElementById('gpsBtn').textContent='Stop GPS';if(followGps)map.panTo(ll);},()=>document.getElementById('gpsState').textContent='GPS unavailable',{enableHighAccuracy:true,maximumAge:1000,timeout:15000});});

function fillBounds(){['north','south','west','east'].forEach(k=>document.getElementById(k).value=bounds[k]);}
function updateOverlay(){imageOverlay.setBounds([[bounds.south,bounds.west],[bounds.north,bounds.east]]);fillBounds();Object.entries(cornerMarkers).forEach(([id,m])=>m.setLatLng(cornerDefs.find(c=>c.id===id).get()));}
fillBounds();document.getElementById('applyBounds').addEventListener('click',()=>{bounds={north:+north.value,south:+south.value,west:+west.value,east:+east.value};localStorage.setItem('rifleBounds',JSON.stringify(bounds));updateOverlay();map.fitBounds(imageOverlay.getBounds());});document.getElementById('resetBounds').addEventListener('click',()=>{bounds={...DEFAULT_BOUNDS};localStorage.removeItem('rifleBounds');updateOverlay();map.fitBounds(imageOverlay.getBounds());});document.getElementById('fitOverlay').addEventListener('click',()=>map.fitBounds(imageOverlay.getBounds(),{padding:[20,20]}));
const calibrationLayer=L.layerGroup(),cornerDefs=[{id:'nw',label:'NW',get:()=>[bounds.north,bounds.west]},{id:'ne',label:'NE',get:()=>[bounds.north,bounds.east]},{id:'sw',label:'SW',get:()=>[bounds.south,bounds.west]},{id:'se',label:'SE',get:()=>[bounds.south,bounds.east]}],cornerMarkers={};
cornerDefs.forEach(c=>{const icon=L.divIcon({className:'',html:'<div class="calibration-handle"></div>',iconSize:[18,18],iconAnchor:[9,9]});const m=L.marker(c.get(),{icon,draggable:true}).addTo(calibrationLayer).bindTooltip(c.label,{permanent:true,direction:'top'});m.on('drag',e=>{const ll=e.target.getLatLng();if(c.id.includes('n'))bounds.north=ll.lat;else bounds.south=ll.lat;if(c.id.includes('w'))bounds.west=ll.lng;else bounds.east=ll.lng;updateOverlay();});cornerMarkers[c.id]=m;});
function setDrag(){const locked=document.getElementById('calibrationLock').checked;Object.values(cornerMarkers).forEach(m=>locked?m.dragging.disable():m.dragging.enable());}document.getElementById('calibrationToggle').addEventListener('change',e=>e.target.checked?calibrationLayer.addTo(map):map.removeLayer(calibrationLayer));document.getElementById('calibrationLock').addEventListener('change',setDrag);setDrag();
document.querySelectorAll('[data-nudge]').forEach(btn=>btn.addEventListener('click',()=>{const s=.00008,o=btn.dataset.nudge;if(o==='north'){bounds.north+=s;bounds.south+=s}if(o==='south'){bounds.north-=s;bounds.south-=s}if(o==='east'){bounds.east+=s;bounds.west+=s}if(o==='west'){bounds.east-=s;bounds.west-=s}if(o==='growY'){bounds.north+=s;bounds.south-=s}if(o==='shrinkY'){bounds.north-=s;bounds.south+=s}if(o==='growX'){bounds.east+=s;bounds.west-=s}if(o==='shrinkX'){bounds.east-=s;bounds.west+=s}updateOverlay();}));

map.fitBounds(imageOverlay.getBounds());updateOverlay();refreshWeather();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
