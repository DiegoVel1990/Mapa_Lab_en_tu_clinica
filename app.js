(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = { map: $('map'), select: $('lab-select'), entity: $('entity-select'), search: $('search-button'), csv: $('download-csv'), results: $('results'), status: $('map-status'), reset: $('reset-map'), radius: $('radius-input'), clear: $('clear-button') };
  const map = L.map(el.map, { zoomControl: false, preferCanvas: true }).setView([23.7, -102.2], 5);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const attribution = 'Tiles &copy; Esri &mdash; Sources: Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, and the GIS User Community';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 16, attribution }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 16, attribution, pane: 'overlayPane' }).addTo(map);
  const clusters = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 48, showCoverageOnHover: false, iconCreateFunction(cluster) {
    const n = cluster.getChildCount(), size = n < 100 ? 40 : n < 1000 ? 50 : 60;
    return L.divIcon({ html: `<div>${n.toLocaleString('es-MX')}</div>`, className: 'leaflet-markercluster-icon', iconSize: [size, size] });
  }}).addTo(map);
  const colors = { Laboratorio: '#9F2241', Estratégica: '#235B4E', Básica: '#BC955C' };
  const sizeFor = (value, breaks) => value <= breaks[0] ? 9 : value <= breaks[1] ? 12 : value <= breaks[2] ? 15 : value <= breaks[3] ? 19 : 24;
  const fmt = new Intl.NumberFormat('es-MX');
  let units = [], labs = [], markers = new Map(), selected = null, circle = null, reference = null, inside = [];
  const esc = (s) => String(s ?? '—').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const popup = (u) => `<div class="popup-title">${esc(u.nombre)}</div><div class="popup-detail"><b>Tipo:</b> ${esc(u.tipo)}<br><b>CLUES:</b> ${esc(u.clues)}<br><b>Órdenes:</b> ${fmt.format(u.ordenes)}<br><b>Municipio:</b> ${esc(u.municipio)}, ${esc(u.entidad)}</div>`;
  const haversine = (a, b) => { const rad = (n) => n * Math.PI / 180; const dLat = rad(b.lat-a.lat), dLng = rad(b.lng-a.lng); const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2; return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h)); };
  const pointIcon = (u) => { const d = sizeFor(u.ordenes, window.orderBreaks), c = colors[u.tipo] || '#68776f'; return L.divIcon({ className:'', html:`<span style="display:block;width:${d}px;height:${d}px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 1px 5px #1c3d2e80"></span>`, iconSize:[d+4,d+4], iconAnchor:[(d+4)/2,(d+4)/2] }); };
  const referenceIcon = () => L.divIcon({ className:'', html:'<span style="display:block;width:18px;height:18px;border-radius:50%;background:#103d32;border:3px solid white;outline:3px solid #103d3240;box-shadow:0 1px 5px #1c3d2e80"></span>', iconSize:[24,24], iconAnchor:[12,12] });
  function clearAnalysis() {
    if (circle) map.removeLayer(circle); if (reference) map.removeLayer(reference);
    circle = reference = null; inside = []; el.csv.hidden = true; el.results.replaceChildren();
    markers.forEach((marker) => marker.getElement()?.classList.remove('marker-dim'));
    clusters.refreshClusters();
  }
  function runSearch() {
    selected = labs.filter(u=>!el.entity.value||u.entidad===el.entity.value)[Number(el.select.value)]; if (!selected) return;
    clearAnalysis(); const center = L.latLng(selected.lat, selected.lng);
    const radiusKm = Math.min(20, Math.max(10, Number(el.radius.value) || 10));
    el.radius.value = String(radiusKm);
    circle = L.circle(center, { radius:radiusKm*1000, color:'#9F2241', weight:2, fillColor:'#c97489', fillOpacity:.10 }).addTo(map);
    reference = L.marker(center, { icon:referenceIcon(), zIndexOffset:1200 }).addTo(map).bindPopup(popup(selected));
    inside = units.filter((u) => u !== selected).map((u) => ({ u, distance:haversine(selected,u) })).filter((x) => x.distance <= radiusKm).sort((a,b) => a.distance-b.distance);
    const ids = new Set(inside.map((x) => x.u));
    markers.forEach((marker, u) => { const node = marker.getElement(); if (node) node.classList.toggle('marker-dim', !ids.has(u) && u !== selected); });
    clusters.refreshClusters();
    const summary = document.createElement('p'); summary.className='result-summary'; summary.textContent = `${fmt.format(inside.length)} unidad${inside.length === 1 ? '' : 'es'} dentro de ${radiusKm} km`;
    el.results.append(summary);
    if (inside.length) {
      const list = document.createElement('ul'); list.className='result-list';
      inside.forEach(({u,distance}) => { const li=document.createElement('li'); const name=document.createElement('strong'); name.textContent=u.nombre; const detail=document.createElement('small'); detail.textContent=`${distance.toFixed(1)} km · ${u.tipo} · ${fmt.format(u.ordenes)} órdenes · ${u.municipio}, ${u.entidad}`; li.append(name,detail); list.append(li); });
      el.results.append(list);
    } else { const note=document.createElement('small'); note.textContent='No hay otras unidades dentro de este radio.'; el.results.append(note); }
    el.csv.hidden = false;
    map.fitBounds(circle.getBounds(), { padding:[40,40], maxZoom:10 });
    el.status.textContent = `${fmt.format(inside.length)} unidades dentro de ${radiusKm} km`; el.status.hidden = false;
  }
  function downloadCsv() {
    const columns = [['FUENTE','fuente'],['CLUES','clues'],['ENTIDAD','entidad'],['MUNICIPIO','municipio'],['NOMBRE','nombre'],['TIPO','tipo'],['LAT','lat'],['LONG','lng'],['ÓRDENES','ordenes']];
    const quote = (value) => `"${String(value ?? '').replace(/"/g,'""')}"`;
    const rows = [[...columns.map(([name])=>name),'DISTANCIA_KM'], ...inside.map(({u,distance})=>[...columns.map(([,key])=>u[key]),distance.toFixed(3)])];
    const blob = new Blob(['\uFEFF', rows.map((row)=>row.map(quote).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob), link=document.createElement('a'); link.href=url; link.download=`unidades_radio_${el.radius.value}km_${selected.clues}.csv`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function renderSizeLegend(breaks) {
    const boxes = [[breaks[0],9],[breaks[1],12],[breaks[2],15],[breaks[3],19],[Infinity,24]];
    $('size-legend').replaceChildren(...boxes.map(([max,d],i)=>{ const item=document.createElement('span'); item.className='size-sample'; const dot=document.createElement('i'); dot.style.width=`${d}px`; dot.style.height=`${d}px`; const label=document.createElement('small'); label.textContent=i===0?`≤${fmt.format(max)}`:i===4?`>${fmt.format(breaks[3])}`:`${fmt.format(breaks[i-1]+1)}–${fmt.format(max)}`; item.append(dot,label); return item; }));
  }
  function renderMap() {
    const values=units.map(u=>u.ordenes).sort((a,b)=>a-b), breaks=[.2,.4,.6,.8].map(q=>values[Math.floor((values.length-1)*q)]);
    window.orderBreaks=breaks; renderSizeLegend(breaks);
    labs=units.filter(u=>u.tipo==='Laboratorio').sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')||a.clues.localeCompare(b.clues,'es'));
    const entities=[...new Set(labs.map(u=>u.entidad).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    entities.forEach(entity=>{const option=document.createElement('option');option.value=entity;option.textContent=entity;el.entity.append(option);});
    function refreshLabOptions(){el.select.replaceChildren(new Option('Selecciona un laboratorio',''));const available=labs.filter(u=>!el.entity.value||u.entidad===el.entity.value);available.forEach((u,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${u.nombre} — ${u.municipio} (${u.clues})`;el.select.append(option);});el.search.disabled=true;clearAnalysis();}
    refreshLabOptions();
    el.search.addEventListener('click',runSearch); el.csv.addEventListener('click',downloadCsv); el.clear.addEventListener('click',()=>{clearAnalysis();el.entity.value='';el.radius.value='10';refreshLabOptions();updateTypeCounts();map.setView([23.7,-102.2],5);el.status.hidden=true;}); el.select.addEventListener('change',()=>{selected=null;clearAnalysis();el.search.disabled=!el.select.value;});
    el.entity.addEventListener('change',()=>{refreshLabOptions();updateTypeCounts();});
    el.radius.addEventListener('change',()=>{const value=Number(el.radius.value);if(!Number.isFinite(value)||value<10||value>20)el.radius.value='10';});
    el.reset.addEventListener('click',()=>{el.clear.click();});
    function updateTypeCounts(){const scoped=el.entity.value?units.filter(u=>u.entidad===el.entity.value):units;const labsInScope=scoped.filter(u=>u.tipo==='Laboratorio');$('unit-count').textContent=fmt.format(units.length);$('lab-count').textContent=fmt.format(labsInScope.length);$('count-lab').textContent=fmt.format(labsInScope.length);$('count-strategic').textContent=fmt.format(scoped.filter(u=>u.tipo==='Estratégica').length);$('count-basic').textContent=fmt.format(scoped.filter(u=>u.tipo==='Básica').length);}
    updateTypeCounts();
    const featureGroup=[];
    units.forEach((u)=>{const marker=L.marker([u.lat,u.lng],{icon:pointIcon(u),title:`${u.nombre} — ${u.tipo} — ${u.ordenes} órdenes`}).bindPopup(popup(u),{maxWidth:300});markers.set(u,marker);featureGroup.push(marker);});
    clusters.addLayers(featureGroup);
    el.status.hidden=true; if(featureGroup.length) map.fitBounds(L.featureGroup(featureGroup).getBounds(),{padding:[20,20]});
  }
  el.search.disabled=true;
  const loadData = window.UNIDADES_DATA ? Promise.resolve(window.UNIDADES_DATA) : fetch('./data/unidades.json').then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();});
  loadData.then(data=>{units=data.filter(u=>Number.isFinite(u.lat)&&Number.isFinite(u.lng)&&u.lat>=-90&&u.lat<=90&&u.lng>=-180&&u.lng<=180).map(u=>({...u,ordenes:Number(u.ordenes)}));renderMap();}).catch(error=>{console.error(error);el.status.textContent='No se pudo cargar la base de unidades.';el.status.hidden=false;});
})();







