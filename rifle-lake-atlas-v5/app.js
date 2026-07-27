const LAKE_CENTER=[44.41155,-83.97986];
const DEFAULT_BOUNDS={north:44.41620,south:44.40515,west:-83.98490,east:-83.97470};
const CONTOUR_SERVICE='https://gisagocss.state.mi.us/arcgis/rest/services/OpenData/hydro/MapServer/export';
const CONTOUR_BOUNDS={north:44.4230,south:44.3990,west:-83.9920,east:-83.9680};
const CALIBRATION_KEY='rifleBoundsV9Legacy';
let bounds=JSON.parse(localStorage.getItem(CALIBRATION_KEY)||'null')||{...DEFAULT_BOUNDS};
let weatherState=null,gpsWatch=null,gpsMarker=null,gpsCircle=null,followGps=false,acceptedReadings=0,lastAccepted=null;

const map=L.map('map',{zoomControl:true,preferCanvas:true}).setView(LAKE_CENTER,15);
const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap'}).addTo(map);
const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Esri imagery'});
let imageOverlay=L.imageOverlay('assets/rifle-lake-user-map.jpg',[[bounds.south,bounds.west],[bounds.north,bounds.east]],{opacity:.45,interactive:false});
function mercatorX(lng){return lng*20037508.342789244/180;}
function mercatorY(lat){const y=Math.log(Math.tan((90+lat)*Math.PI/360))/(Math.PI/180);return y*20037508.342789244/180;}
function contourImageUrl(){
  const b=CONTOUR_BOUNDS;
  const west=mercatorX(b.west), south=mercatorY(b.south), east=mercatorX(b.east), north=mercatorY(b.north);
  const bbox=[west,south,east,north].join(',');

  // ArcGIS changes the requested geographic extent when the output image's
  // aspect ratio does not match the bbox. The old square 1600x1600 request
  // therefore produced a raster whose true extent differed from the Leaflet
  // bounds, making the contours look shifted. Match the pixel dimensions to
  // the Web Mercator bbox so every exported pixel lands at its correct GPS
  // coordinate.
  const maxDimension=1800;
  const projectedWidth=east-west;
  const projectedHeight=north-south;
  const width=Math.max(1,Math.round(maxDimension*projectedWidth/projectedHeight));
  const height=maxDimension;

  const params=new URLSearchParams({
    bbox,
    bboxSR:'3857',
    imageSR:'3857',
    size:`${width},${height}`,
    dpi:'192',
    format:'png32',
    transparent:'true',
    layers:'show:4',
    f:'image',
    _v:'11'
  });
  return `${CONTOUR_SERVICE}?${params.toString()}`;
}
const stateContours=L.imageOverlay(contourImageUrl(),[[CONTOUR_BOUNDS.south,CONTOUR_BOUNDS.west],[CONTOUR_BOUNDS.north,CONTOUR_BOUNDS.east]],{opacity:1,interactive:false,crossOrigin:true}).addTo(map);
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
function scoreAreas(){const h=new Date().getHours(),wind=weatherState?.windSpeed||0,dir=weatherState?.windDir||0,cloud=weatherState?.cloud||0;return areas.map(a=>{let s=0;if(h<9&&a.tags.includes('morning'))s+=4;if(h>=9&&h<17&&a.tags.includes('sun'))s+=cloud<55?3:1;if(h>=17&&a.tags.includes('evening'))s+=4;if(cloud>60&&a.tags.includes('cloud'))s+=3;if(wind>7&&a.tags.includes('wind'))s+=4;if(wind<6&&a.tags.includes('calm'))s+=3;if(dir>=225&&dir<=315&&a.tags.includes('east'))s+=3;if(dir>=45&&dir<=135&&a.tags.includes('west'))s+=3;if(wind>12&&a.tags.includes('narrows'))s+=2;if(h>=10&&a.tags.includes('deep'))s+=2;return {...a,score:s};}).sort((a,b)=>b.score-a.score).slice(0,3);}
function drawRecommendations(top){recommendations.clearLayers();const labels=['START','NEXT','BACKUP'];top.forEach((a,i)=>{const cls=i===1?'secondary':i===2?'backup':'';L.circle([a.lat,a.lng],{radius:i===0?115:90,color:i===0?'#65c7b0':i===1?'#d8e4e8':'#f3c968',weight:3,fillOpacity:.14}).addTo(recommendations).bindPopup(`<strong>${labels[i]}: ${a.name}</strong><br>${a.depth}<br>${a.first}<br>Follow-up: ${a.follow}`);L.marker([a.lat,a.lng],{icon:L.divIcon({className:'recommend-label',html:`<span class="recommend-chip ${cls}">${labels[i]}</span>`,iconAnchor:[28,15]})}).addTo(recommendations);});}
function renderPlan(){const top=scoreAreas();if(!top.length)return;drawRecommendations(top);const p=top[0],wind=weatherState?`${compass(weatherState.windDir)} ${Math.round(weatherState.windSpeed)} mph`:'current wind';planHeadline.textContent=`Start on ${p.name}`;startArea.textContent=p.name;targetDepth.textContent=p.depth;firstBait.textContent=p.first;followBait.textContent=p.follow;planReason.textContent=`Best current fit for ${wind}, ${weatherState?.cloud??'—'}% cloud cover, and this time of day.`;rankedAreas.innerHTML=top.map((a,i)=>`<div class="area-card"><strong>${['1. Start','2. Next','3. Backup'][i]} — ${a.name}</strong><span>${a.depth} • ${a.first} → ${a.follow}</span><button type="button" data-area="${areas.findIndex(x=>x.name===a.name)}">Show on map</button></div>`).join('');document.querySelectorAll('[data-area]').forEach(b=>b.addEventListener('click',()=>{const a=areas[+b.dataset.area];map.setView([a.lat,a.lng],16);}));}
async function refreshWeather(){const url='https://api.open-meteo.com/v1/forecast?latitude=44.4086&longitude=-83.9798&current=temperature_2m,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7';try{const r=await fetch(url);if(!r.ok)throw new Error();const d=await r.json(),c=d.current;weatherState={air:c.temperature_2m,cloud:c.cloud_cover,rain:c.precipitation,windSpeed:c.wind_speed_10m,windDir:c.wind_direction_10m,daily:d.daily};air.textContent=`${Math.round(c.temperature_2m)}°F`;wind.textContent=`${compass(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)} mph`;clouds.textContent=`${Math.round(c.cloud_cover)}%`;rain.textContent=`${c.precipitation.toFixed(2)} in`;estimateWater(d);renderPlan();windControl.getContainer().textContent=`Wind ${compass(c.wind_direction_10m)} ${Math.round(c.wind_speed_10m)} mph`;}catch{planHeadline.textContent='Weather unavailable — use seasonal plan';renderPlan();}}
function estimateWater(d){const highs=d.daily.temperature_2m_max,lows=d.daily.temperature_2m_min,avg=highs.reduce((s,v,i)=>s+(v+lows[i])/2,0)/highs.length,surface=Math.round(avg*.67+24);surfaceTemp.textContent=`${surface}°F`;weedTemp.textContent=`${surface-1}–${surface+1}°F`;edgeTemp.textContent=`${surface-5}–${surface-2}°F`;thermo.textContent=surface>70?'14–20 ft':'weak / forming';confidence.textContent='medium';}
const windControl=L.control({position:'topright'});windControl.onAdd=()=>{const d=L.DomUtil.create('div','leaflet-control wind-control');d.textContent='Wind —';return d};windControl.addTo(map);
weatherBtn.addEventListener('click',refreshWeather);refreshPlan.addEventListener('click',refreshWeather);
opacity.addEventListener('input',e=>{imageOverlay.setOpacity(e.target.value/100);opacityValue.textContent=`${e.target.value}%`;});
userMapToggle.addEventListener('change',e=>e.target.checked?imageOverlay.addTo(map):map.removeLayer(imageOverlay));
satelliteToggle.addEventListener('change',e=>{if(e.target.checked){map.removeLayer(street);satellite.addTo(map);}else{map.removeLayer(satellite);street.addTo(map);}stateContours.bringToFront();recommendations.bringToFront();if(map.hasLayer(imageOverlay))imageOverlay.bringToFront();});
recommendationToggle.addEventListener('change',e=>e.target.checked?recommendations.addTo(map):map.removeLayer(recommendations));
stateToggle.addEventListener('change',e=>e.target.checked?stateContours.addTo(map):map.removeLayer(stateContours));
map.on('click',e=>mapReadout.textContent=`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
function loadContours(){
  contourStatus.textContent='Loading official Michigan depth contours…';
  stateContours.once('load',()=>{contourStatus.textContent='Official Michigan depth contours loaded and geographically aligned with GPS.';});
  stateContours.once('error',()=>{contourStatus.textContent='Official contour service did not load. Check internet connection, then reload the app.';});
  stateContours.setUrl(contourImageUrl());
}
centerBtn.addEventListener('click',()=>map.setView(LAKE_CENTER,15));followBtn.addEventListener('click',()=>{followGps=!followGps;followBtn.textContent=followGps?'Following':'Follow';});
function qualityFor(acc){if(acc<=8)return ['Excellent','excellent'];if(acc<=15)return ['Good','good'];if(acc<=30)return ['Fair','fair'];return ['Poor','poor'];}
function updateGpsUi(acc){const feet=Math.round(acc*3.28084),[label,cls]=qualityFor(acc);gpsState.textContent=`GPS ±${feet} ft`;gpsAccuracy.textContent=`±${feet} ft`;gpsBadge.textContent=label;gpsBadge.className=`status gps-${cls}`;gpsQuality.textContent=acc<=15?'Position ready':acc<=30?'Wait for a tighter fix':'Do not rely on dot yet';gpsQuality.className=`gps-quality gps-${cls}`;gpsAccepted.textContent=acceptedReadings;}
gpsBtn.addEventListener('click',()=>{if(!navigator.geolocation){alert('GPS is not supported.');return;}if(gpsWatch!=null){navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null;gpsState.textContent='GPS off';gpsQuality.textContent='GPS stopped';gpsBtn.textContent='Use GPS';gpsBadge.textContent='off';return;}gpsState.textContent='Acquiring GPS…';gpsQuality.textContent='Keep phone in clear view of sky';gpsWatch=navigator.geolocation.watchPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude],acc=p.coords.accuracy;updateGpsUi(acc);if(acc>75)return;const now=Date.now();if(lastAccepted&&acc>lastAccepted.acc*1.8&&now-lastAccepted.time<5000)return;lastAccepted={acc,time:now};acceptedReadings++;gpsAccepted.textContent=acceptedReadings;if(!gpsMarker){gpsCircle=L.circle(ll,{radius:acc,color:'#2477ff',weight:2,fillOpacity:.10}).addTo(map);gpsMarker=L.circleMarker(ll,{radius:8,color:'#fff',weight:3,fillColor:'#2477ff',fillOpacity:1}).addTo(map);}else{gpsMarker.setLatLng(ll);gpsCircle.setLatLng(ll).setRadius(acc);}gpsBtn.textContent='Stop GPS';if(followGps||acceptedReadings===1)map.setView(ll,Math.max(map.getZoom(),17));},err=>{gpsState.textContent='GPS unavailable';gpsQuality.textContent=err.message||'Check location permission';},{enableHighAccuracy:true,maximumAge:0,timeout:20000});});
function fillBounds(){['north','south','west','east'].forEach(k=>document.getElementById(k).value=bounds[k]);}
function updateOverlay(){imageOverlay.setBounds([[bounds.south,bounds.west],[bounds.north,bounds.east]]);fillBounds();Object.entries(cornerMarkers).forEach(([id,m])=>m.setLatLng(cornerDefs.find(c=>c.id===id).get()));}
fillBounds();applyBounds.addEventListener('click',()=>{bounds={north:+north.value,south:+south.value,west:+west.value,east:+east.value};localStorage.setItem(CALIBRATION_KEY,JSON.stringify(bounds));updateOverlay();});resetBounds.addEventListener('click',()=>{bounds={...DEFAULT_BOUNDS};localStorage.removeItem(CALIBRATION_KEY);updateOverlay();});fitOverlay.addEventListener('click',()=>map.fitBounds(imageOverlay.getBounds(),{padding:[20,20]}));
const calibrationLayer=L.layerGroup(),cornerDefs=[{id:'nw',label:'NW',get:()=>[bounds.north,bounds.west]},{id:'ne',label:'NE',get:()=>[bounds.north,bounds.east]},{id:'sw',label:'SW',get:()=>[bounds.south,bounds.west]},{id:'se',label:'SE',get:()=>[bounds.south,bounds.east]}],cornerMarkers={};
cornerDefs.forEach(c=>{const icon=L.divIcon({className:'',html:'<div class="calibration-handle"></div>',iconSize:[18,18],iconAnchor:[9,9]});const m=L.marker(c.get(),{icon,draggable:true}).addTo(calibrationLayer).bindTooltip(c.label,{permanent:true,direction:'top'});m.on('drag',e=>{const ll=e.target.getLatLng();if(c.id.includes('n'))bounds.north=ll.lat;else bounds.south=ll.lat;if(c.id.includes('w'))bounds.west=ll.lng;else bounds.east=ll.lng;updateOverlay();});cornerMarkers[c.id]=m;});
function setDrag(){const locked=calibrationLock.checked;Object.values(cornerMarkers).forEach(m=>locked?m.dragging.disable():m.dragging.enable());}calibrationToggle.addEventListener('change',e=>e.target.checked?calibrationLayer.addTo(map):map.removeLayer(calibrationLayer));calibrationLock.addEventListener('change',setDrag);setDrag();
document.querySelectorAll('[data-nudge]').forEach(btn=>btn.addEventListener('click',()=>{const s=.00008,o=btn.dataset.nudge;if(o==='north'){bounds.north+=s;bounds.south+=s}if(o==='south'){bounds.north-=s;bounds.south-=s}if(o==='east'){bounds.east+=s;bounds.west+=s}if(o==='west'){bounds.east-=s;bounds.west-=s}if(o==='growY'){bounds.north+=s;bounds.south-=s}if(o==='shrinkY'){bounds.north-=s;bounds.south+=s}if(o==='growX'){bounds.east+=s;bounds.west-=s}if(o==='shrinkX'){bounds.east-=s;bounds.west+=s}updateOverlay();}));
updateOverlay();loadContours();refreshWeather();
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
