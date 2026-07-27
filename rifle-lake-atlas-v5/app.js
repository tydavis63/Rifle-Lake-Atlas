const LAKE_CENTER = [44.4085833, -83.9797917];
const DEFAULT_BOUNDS = { north: 44.4200, south: 44.4000, west: -83.9900, east: -83.9700 };
const CONTOUR_URL = 'https://gisagocss.state.mi.us/arcgis/rest/services/OpenData/hydro/MapServer/4/query?where=1%3D1&geometry=-83.995%2C44.395%2C-83.965%2C44.43&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=DEPTH%2COBJECTID&returnGeometry=true&outSR=4326&f=geojson';
let bounds = JSON.parse(localStorage.getItem('rifleBounds') || 'null') || { ...DEFAULT_BOUNDS };
let weatherState = null;

const map = L.map('map', { zoomControl: true }).setView(LAKE_CENTER, 14);
const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri imagery' });
let imageOverlay = L.imageOverlay('assets/rifle-lake-user-map.jpg', [[bounds.south, bounds.west], [bounds.north, bounds.east]], { opacity: .68, interactive: false }).addTo(map);

const stateContours = L.geoJSON(null, {
  style: f => {
    const depth = Number(f.properties?.DEPTH || 0);
    return { color: depth % 10 === 0 ? '#e8f6ff' : '#70c8ef', weight: depth % 10 === 0 ? 2.3 : 1.1, opacity: .92 };
  },
  onEachFeature: (f, layer) => {
    const depth = f.properties?.DEPTH;
    if (depth != null) layer.bindTooltip(`${depth} ft`, { direction: 'center', className: 'depth-label' });
  }
}).addTo(map);

const zonesData = [
  { n:1,name:'North basin weed edge',lat:44.4178,lng:-83.9811,depth:'8–16 ft',time:'First light / evening',baits:'Walking bait, spybait, drop shot',tags:['north','shallow','calm'] },
  { n:2,name:'Northwest inside turn',lat:44.4162,lng:-83.9852,depth:'10–18 ft',time:'Morning / cloudy',baits:'Ned rig, finesse jig, drop shot',tags:['west','cloud','finesse'] },
  { n:3,name:'North basin east point',lat:44.4159,lng:-83.9754,depth:'8–15 ft',time:'Wind-driven periods',baits:'Swim jig, chatterbait, jerkbait',tags:['east','wind','moving'] },
  { n:4,name:'Narrows north lip',lat:44.4133,lng:-83.9808,depth:'10–22 ft',time:'All day',baits:'Drop shot, Ned rig, small swimbait',tags:['narrows','deep','all'] },
  { n:5,name:'Narrows south lip',lat:44.4114,lng:-83.9802,depth:'8–18 ft',time:'Morning / evening',baits:'Spybait, tube, drop shot',tags:['narrows','finesse'] },
  { n:6,name:'West mid-lake point',lat:44.4093,lng:-83.9851,depth:'10–20 ft',time:'Midday',baits:'Football jig, drop shot, Carolina rig',tags:['west','deep','sun'] },
  { n:7,name:'East mid-lake break',lat:44.4082,lng:-83.9748,depth:'12–24 ft',time:'Sunny midday',baits:'Drop shot, Ned rig, finesse swimbait',tags:['east','deep','sun'] },
  { n:8,name:'Southwest shelf',lat:44.4055,lng:-83.9843,depth:'7–15 ft',time:'First light',baits:'Topwater, swim jig, weightless fluke',tags:['west','shallow','morning'] },
  { n:9,name:'South basin deep edge',lat:44.4029,lng:-83.9797,depth:'15–28 ft',time:'Late morning / afternoon',baits:'Drop shot, spoon, jig worm',tags:['deep','sun'] },
  { n:10,name:'Southeast point',lat:44.4050,lng:-83.9742,depth:'8–18 ft',time:'Evening / west wind',baits:'Chatterbait, jerkbait, Ned rig',tags:['east','wind','evening'] }
];
const zones = L.layerGroup().addTo(map);
const zoneMarkers = new Map();
zonesData.forEach(z => {
  const icon = L.divIcon({ className: 'zone-marker', html: String(z.n), iconSize: [28,28], iconAnchor: [14,14] });
  const marker = L.marker([z.lat,z.lng], { icon }).addTo(zones).on('click', () => showZone(z)).bindPopup(`<strong>${z.name}</strong><br>${z.depth}<br>${z.baits}`);
  zoneMarkers.set(z.n, marker);
});

L.control.layers({ Street: street, Satellite: satellite }, { 'Your contour map': imageOverlay, 'Michigan contours': stateContours, 'Fishing zones': zones }, { collapsed: true }).addTo(map);

const windControl = L.control({ position: 'topright' });
windControl.onAdd = () => { const d = L.DomUtil.create('div','leaflet-control wind-control'); d.id='windControl'; d.textContent='Wind —'; return d; };
windControl.addTo(map);

function cacheContours(data){ try { localStorage.setItem('rifleContourCache', JSON.stringify(data)); localStorage.setItem('rifleContourCacheTime', new Date().toISOString()); } catch(_) {} }
async function loadContours(){
  const status = document.getElementById('contourStatus');
  const cached = localStorage.getItem('rifleContourCache');
  if (cached) { try { const data=JSON.parse(cached); stateContours.addData(data); status.textContent=`${data.features.length} cached lines`; } catch(_) {} }
  try {
    const r = await fetch(CONTOUR_URL);
    if (!r.ok) throw new Error('service');
    const data = await r.json();
    stateContours.clearLayers().addData(data); cacheContours(data);
    status.textContent = `${data.features.length} state lines`;
  } catch(e) {
    if (!stateContours.getLayers().length) status.textContent = 'state service unavailable';
  }
}
loadContours();

function showZone(z){
  document.getElementById('zoneName').textContent=z.name;
  document.getElementById('zoneRank').textContent=`Area ${z.n}`;
  document.getElementById('zoneInfo').innerHTML=`<div class="detail-row"><span>Target depth</span><strong>${z.depth}</strong></div><div class="detail-row"><span>Best window</span><strong>${z.time}</strong></div><div class="detail-row"><span>Baits</span><strong>${z.baits}</strong></div>`;
}

const compass = d => ['N','NE','E','SE','S','SW','W','NW'][Math.round(d/45)%8];
function rankZones(){
  const now = new Date(); const hour = now.getHours();
  const cloud = weatherState?.cloud_cover ?? 45; const wind = weatherState?.wind_speed_10m ?? 6; const dir = weatherState?.wind_direction_10m ?? 270;
  const windFromWest = dir >= 180 && dir <= 360;
  const scored = zonesData.map(z => {
    let score=50; const why=[];
    if (hour < 9 && z.tags.includes('morning')) { score+=18; why.push('first-light window'); }
    if (hour >= 10 && hour <= 16 && z.tags.includes('deep')) { score+=14; why.push('midday depth'); }
    if (hour > 17 && z.tags.includes('evening')) { score+=15; why.push('evening window'); }
    if (cloud > 60 && (z.tags.includes('cloud') || z.tags.includes('moving'))) { score+=13; why.push('cloud cover'); }
    if (cloud < 35 && (z.tags.includes('deep') || z.tags.includes('sun'))) { score+=12; why.push('bright-sun positioning'); }
    if (wind > 8 && z.tags.includes('wind')) { score+=15; why.push('wind activation'); }
    if (wind > 8 && windFromWest && z.tags.includes('east')) { score+=9; why.push('windward east bank'); }
    if (wind < 5 && z.tags.includes('calm')) { score+=10; why.push('calm-water topwater'); }
    return { ...z, score, why: why.slice(0,2).join(' + ') || 'reliable seasonal structure' };
  }).sort((a,b)=>b.score-a.score).slice(0,5);
  const list=document.getElementById('rankedZones'); list.innerHTML='';
  scored.forEach((z,i)=>{ const li=document.createElement('li'); const b=document.createElement('button'); b.type='button'; b.textContent=`${i+1}. Area ${z.n} — ${z.name}`; b.addEventListener('click',()=>{showZone(z);map.setView([z.lat,z.lng],16);zoneMarkers.get(z.n).openPopup();}); const sm=document.createElement('small'); sm.textContent=`${z.depth} • ${z.why}`; li.append(b,sm); list.appendChild(li); });
}

async function updateWeather(){
  try {
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${LAKE_CENTER[0]}&longitude=${LAKE_CENTER[1]}&current=temperature_2m,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation&hourly=temperature_2m&past_days=7&forecast_days=1&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FDetroit`;
    const r=await fetch(u); const d=await r.json(); const c=d.current; weatherState=c;
    document.getElementById('air').textContent=`${Math.round(c.temperature_2m)}°F`;
    document.getElementById('wind').textContent=`${compass(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)} mph`;
    document.getElementById('clouds').textContent=`${c.cloud_cover}%`; document.getElementById('rain').textContent=`${c.precipitation.toFixed(2)} in`;
    document.getElementById('windControl').textContent=`Wind ${compass(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)} mph`;
    const temps=d.hourly.temperature_2m.slice(0,168); const weighted=temps.reduce((s,t,i)=>s+t*(i+1),0)/temps.reduce((s,_,i)=>s+i+1,0); let surface=weighted*.72+18; surface+=c.cloud_cover<35?1.2:0; surface-=c.wind_speed_10m>12?.8:0; surface=Math.max(62,Math.min(84,surface));
    document.getElementById('surfaceTemp').textContent=`${Math.round(surface-1)}–${Math.round(surface+1)}°F`; document.getElementById('weedTemp').textContent=`${Math.round(surface-3)}–${Math.round(surface)}°F`; document.getElementById('edgeTemp').textContent=`${Math.round(surface-8)}–${Math.round(surface-4)}°F`; document.getElementById('thermo').textContent='15–22 ft'; document.getElementById('confidence').textContent='moderate'; rankZones();
  } catch(e) { document.getElementById('confidence').textContent='weather offline'; rankZones(); }
}
updateWeather(); document.getElementById('weatherBtn').addEventListener('click',updateWeather); document.getElementById('rankBtn').addEventListener('click',rankZones);

let watchId=null,gpsMarker=null,accuracyCircle=null,follow=true;
document.getElementById('gpsBtn').addEventListener('click',()=>{
  if(!navigator.geolocation){alert('GPS is not supported.');return;}
  if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;document.getElementById('gpsState').textContent='GPS off';return;}
  watchId=navigator.geolocation.watchPosition(p=>{
    const ll=[p.coords.latitude,p.coords.longitude];
    if(!gpsMarker){gpsMarker=L.circleMarker(ll,{radius:7,color:'#fff',weight:3,fillColor:'#3fa9ff',fillOpacity:1}).addTo(map);accuracyCircle=L.circle(ll,{radius:p.coords.accuracy,color:'#3fa9ff',weight:1,fillOpacity:.08}).addTo(map);} else {gpsMarker.setLatLng(ll);accuracyCircle.setLatLng(ll).setRadius(p.coords.accuracy);}
    document.getElementById('gpsState').textContent=`±${Math.round(p.coords.accuracy*3.28084)} ft`; if(follow) map.panTo(ll);
  },()=>{document.getElementById('gpsState').textContent='GPS permission needed';},{enableHighAccuracy:true,maximumAge:1000,timeout:12000});
});
document.getElementById('followBtn').addEventListener('click',()=>{follow=!follow;document.getElementById('followBtn').textContent=follow?'Following':'Follow';});
document.getElementById('centerBtn').addEventListener('click',()=>map.setView(LAKE_CENTER,15));

function applyPreset(name){
  document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));
  [imageOverlay,stateContours,zones].forEach(l=>{if(map.hasLayer(l))map.removeLayer(l);}); if(map.hasLayer(street))map.removeLayer(street); if(map.hasLayer(satellite))map.removeLayer(satellite);
  if(name==='hybrid'){satellite.addTo(map);imageOverlay.addTo(map);stateContours.addTo(map);zones.addTo(map);imageOverlay.setOpacity(.55);}
  if(name==='user'){street.addTo(map);imageOverlay.addTo(map);zones.addTo(map);imageOverlay.setOpacity(.9);}
  if(name==='state'){satellite.addTo(map);stateContours.addTo(map);zones.addTo(map);}
  if(name==='satellite'){satellite.addTo(map);zones.addTo(map);}
}
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
document.getElementById('disagreementToggle').addEventListener('change',e=>document.body.classList.toggle('source-disagreement',e.target.checked));
document.getElementById('opacity').addEventListener('input',e=>{const v=e.target.value;imageOverlay.setOpacity(v/100);document.getElementById('opacityValue').textContent=`${v}%`;});
document.getElementById('userMapToggle').addEventListener('change',e=>e.target.checked?imageOverlay.addTo(map):map.removeLayer(imageOverlay));
document.getElementById('stateToggle').addEventListener('change',e=>e.target.checked?stateContours.addTo(map):map.removeLayer(stateContours));
document.getElementById('zonesToggle').addEventListener('change',e=>e.target.checked?zones.addTo(map):map.removeLayer(zones));

function nearestContour(latlng){
  let best={distance:Infinity,depth:null};
  stateContours.eachLayer(layer=>{
    const depth=layer.feature?.properties?.DEPTH; if(depth==null || !layer.getLatLngs) return;
    const scan = arr => arr.forEach(v=>Array.isArray(v)?scan(v):(()=>{const d=latlng.distanceTo(v);if(d<best.distance)best={distance:d,depth};})());
    scan(layer.getLatLngs());
  });
  return best;
}
map.on('click',e=>{const n=nearestContour(e.latlng);const contour=n.depth!=null&&n.distance<250?`nearest state contour ${n.depth} ft (${Math.round(n.distance*3.28084)} ft away)`:'no nearby loaded state contour';document.getElementById('mapReadout').textContent=`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)} • ${contour}`;});

function fillBounds(){['north','south','west','east'].forEach(k=>document.getElementById(k).value=bounds[k]);}
function updateOverlayFromBounds(){imageOverlay.setBounds([[bounds.south,bounds.west],[bounds.north,bounds.east]]);fillBounds();Object.entries(cornerMarkers).forEach(([id,m])=>m.setLatLng(cornerDefs.find(c=>c.id===id).get()));document.getElementById('alignmentQuality').textContent=localStorage.getItem('rifleBounds')?'saved remote calibration':'published-extent preset';}
fillBounds();
document.getElementById('applyBounds').addEventListener('click',()=>{bounds={north:+north.value,south:+south.value,west:+west.value,east:+east.value};localStorage.setItem('rifleBounds',JSON.stringify(bounds));updateOverlayFromBounds();map.fitBounds(imageOverlay.getBounds());});
document.getElementById('resetBounds').addEventListener('click',()=>{bounds={...DEFAULT_BOUNDS};localStorage.removeItem('rifleBounds');updateOverlayFromBounds();map.fitBounds(imageOverlay.getBounds());});

const calibrationLayer=L.layerGroup();
const cornerDefs=[{id:'nw',label:'NW',get:()=>[bounds.north,bounds.west]},{id:'ne',label:'NE',get:()=>[bounds.north,bounds.east]},{id:'sw',label:'SW',get:()=>[bounds.south,bounds.west]},{id:'se',label:'SE',get:()=>[bounds.south,bounds.east]}];
const cornerMarkers={};
function setCalibrationDraggable(){const locked=document.getElementById('calibrationLock').checked;Object.values(cornerMarkers).forEach(m=>locked?m.dragging.disable():m.dragging.enable());}
cornerDefs.forEach(c=>{const icon=L.divIcon({className:'',html:`<div class="calibration-handle" title="${c.label}"></div>`,iconSize:[18,18],iconAnchor:[9,9]});const m=L.marker(c.get(),{icon,draggable:true}).addTo(calibrationLayer).bindTooltip(c.label,{permanent:true,direction:'top'});m.on('drag',e=>{const ll=e.target.getLatLng();if(c.id.includes('n'))bounds.north=ll.lat;else bounds.south=ll.lat;if(c.id.includes('w'))bounds.west=ll.lng;else bounds.east=ll.lng;updateOverlayFromBounds();});cornerMarkers[c.id]=m;});
document.getElementById('calibrationToggle').addEventListener('change',e=>e.target.checked?calibrationLayer.addTo(map):map.removeLayer(calibrationLayer));
document.getElementById('calibrationLock').addEventListener('change',setCalibrationDraggable); setCalibrationDraggable();
document.getElementById('fitOverlay').addEventListener('click',()=>map.fitBounds(imageOverlay.getBounds(),{padding:[20,20]}));
document.querySelectorAll('[data-nudge]').forEach(btn=>btn.addEventListener('click',()=>{const step=.00008,op=btn.dataset.nudge;if(op==='north'){bounds.north+=step;bounds.south+=step}if(op==='south'){bounds.north-=step;bounds.south-=step}if(op==='east'){bounds.east+=step;bounds.west+=step}if(op==='west'){bounds.east-=step;bounds.west-=step}if(op==='growY'){bounds.north+=step;bounds.south-=step}if(op==='shrinkY'){bounds.north-=step;bounds.south+=step}if(op==='growX'){bounds.east+=step;bounds.west-=step}if(op==='shrinkX'){bounds.east-=step;bounds.west+=step}updateOverlayFromBounds();}));

map.fitBounds(imageOverlay.getBounds()); updateOverlayFromBounds();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
