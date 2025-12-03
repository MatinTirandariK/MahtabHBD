// --- مدیریت لودینگ ---
const loader = document.getElementById('loader');
const manager = new THREE.LoadingManager();
manager.onLoad = function () {
    const loadingText = document.querySelector('.loader-content p');
    if(loadingText) loadingText.innerText = "جهان آماده است...";
    setTimeout(() => { loader.style.opacity = 0; setTimeout(()=>{loader.style.display='none'}, 1000)}, 1000);
};

// --- صحنه و رندر ---
const canvas = document.querySelector('#webgl');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
// مه آبی تیره برای عمق (کمی رقیق‌تر برای دیدن دوردست)
scene.fog = new THREE.FogExp2(0x020205, 0.008);

const sizes = { width: window.innerWidth, height: window.innerHeight };
// دوربین در موقعیت سینمایی (لب دریاچه)
const camera = new THREE.PerspectiveCamera(55, sizes.width / sizes.height, 0.1, 10000);
camera.position.set(0, 4, 30); 

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// --- کنترلر ---
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.minDistance = 5;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // جلوگیری از رفتن زیر آب
controls.autoRotate = true;
controls.autoRotateSpeed = 0.2; // چرخش بسیار آرام و رویایی

// --- بافت‌ها (Textures) ---
const textureLoader = new THREE.TextureLoader(manager);
// بافت ماه
const moonColorMap = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg');
// نرمال مپ برای برجستگی چاله‌های ماه
const moonNormalMap = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/mars_1k_normal.jpg'); 
// بافت آب
const waterNormalMap = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/water/Water_1_M_Normal.jpg');
waterNormalMap.wrapS = waterNormalMap.wrapT = THREE.RepeatWrapping;
waterNormalMap.repeat.set(10, 10);
// بافت ستاره
const starSprite = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/snowflake1.png');

// --- نورپردازی ---
const ambientLight = new THREE.AmbientLight(0x404060, 0.6); // نور محیطی مهتابی
scene.add(ambientLight);

// نور اصلی ماه (منبع سایه)
const moonLight = new THREE.DirectionalLight(0xaaccff, 1.5);
moonLight.position.set(0, 100, -200);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.far = 1000;
moonLight.shadow.camera.left = -500; moonLight.shadow.camera.right = 500;
moonLight.shadow.camera.top = 500; moonLight.shadow.camera.bottom = -500;
scene.add(moonLight);

// نور سبز از پایین برای چمن‌ها
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x004400, 0.3);
scene.add(hemiLight);


// --- ۱. دریاچه و رودخانه (Water) ---
const waterGeo = new THREE.PlaneGeometry(3000, 3000);
const waterMat = new THREE.MeshStandardMaterial({
    color: 0x001e0f, // آبی/سبز تیره اقیانوسی
    metalness: 0.95,
    roughness: 0.05, // بسیار صیقلی
    normalMap: waterNormalMap,
    normalScale: new THREE.Vector2(0.8, 0.8)
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = 0; // سطح آب روی صفر
water.receiveShadow = true;
scene.add(water);


// --- ۲. کوهستان و خشکی (Terrain) ---
const simplex = new SimplexNoise();
const terrainGeo = new THREE.PlaneGeometry(800, 800, 200, 200);
const terrainPos = terrainGeo.attributes.position;

for (let i = 0; i < terrainPos.count; i++) {
    const x = terrainPos.getX(i);
    const y = terrainPos.getY(i);
    const dist = Math.sqrt(x*x + y*y);

    // ایجاد رودخانه در مرکز: اگر نزدیک مرکز (مسیر Z) باشد، ارتفاع کم می‌شود
    // استفاده از نویز برای طبیعی شدن مسیر رودخانه
    let riverPath = Math.sin(y * 0.01) * 30 + Math.sin(y * 0.05) * 10;
    let distFromRiver = Math.abs(x - riverPath);
    let riverMask = smoothstep(10, 60, distFromRiver); // عرض رودخانه

    let elevation = 0;
    // کوه‌های اصلی
    elevation += simplex.noise2D(x * 0.01, y * 0.01) * 40;
    // جزئیات سنگ‌ها
    elevation += simplex.noise2D(x * 0.03, y * 0.03) * 10;
    
    // اعمال ماسک رودخانه (جایی که رودخانه هست، ارتفاع منفی شود تا آب دیده شود)
    elevation = elevation * riverMask + (riverMask - 1) * 10;
    
    // اطراف دوربین (مبدا) را کمی صاف کن تا چمن‌ها دیده شوند
    if (dist < 50) elevation = Math.max(elevation, 1.5);

    terrainPos.setZ(i, elevation);
}
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x1a2d1a, // سبز لجنی تیره (زمین چمن)
    roughness: 0.9,
    metalness: 0.1
});
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;
terrain.castShadow = true;
scene.add(terrain);

function smoothstep(min, max, value) {
  var x = Math.max(0, Math.min(1, (value-min)/(max-min)));
  return x*x*(3 - 2*x);
}


// --- ۳. چمن‌زار انبوه و زیبا ---
// فقط در جاهایی که ارتفاع بالاتر از آب است
const grassCount = 100000; // تعداد بسیار زیاد برای تراکم بالا
const grassGeo = new THREE.PlaneGeometry(0.3, 1.5, 1, 3);
grassGeo.translate(0, 0.75, 0); // پیوت پایین

const grassMat = new THREE.MeshStandardMaterial({
    color: 0x44aa44, // سبز زنده
    emissive: 0x001100, // کمی درخشش ذاتی برای دیده شدن در شب
    side: THREE.DoubleSide,
    roughness: 0.8,
    onBeforeCompile: (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.vertexShader = `
            uniform float uTime;
            attribute float aScale;
            ${shader.vertexShader.replace('#include <begin_vertex>', `
                #include <begin_vertex>
                // باد ملایم
                float wind = sin(uTime * 1.0 + transformMatrix[3][0] * 0.5 + transformMatrix[3][2] * 0.5) * 0.2;
                // خم شدن
                transformed.x += position.y * position.y * wind;
                transformed.z += position.y * position.y * wind * 0.5;
                transformed *= aScale;
            `)}
        `;
        grassMat.userData.shader = shader;
    }
});

const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
const dummy = new THREE.Object3D();
const scales = new Float32Array(grassCount);
let gIdx = 0;

for (let i = 0; i < terrainPos.count; i++) {
    const x = terrainPos.getX(i);
    const z = terrainPos.getY(i);
    const y = terrainPos.getZ(i);

    // کاشت چمن: اگر بالای آب است و شیب خیلی تند نیست
    // y > 1 یعنی بالاتر از سطح آب
    // y < 35 یعنی روی قله‌های برفی نباشد
    if (y > 1 && y < 35 && Math.random() > 0.6 && gIdx < grassCount) {
        dummy.position.set(x, y - 0.2, z); // کمی فرو رفته در زمین
        dummy.rotation.y = Math.random() * Math.PI;
        // مقیاس تصادفی برای طبیعی شدن
        const s = 0.5 + Math.random() * 0.8;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        grass.setMatrixAt(gIdx, dummy.matrix);
        scales[gIdx] = s;
        gIdx++;
    }
}
grass.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
grass.receiveShadow = true;
scene.add(grass);


// --- ۴. ماه ۴K با جزئیات و درخشش ---
const moonGroup = new THREE.Group();

// کره ماه
const moonMat = new THREE.MeshStandardMaterial({ 
    map: moonColorMap,
    normalMap: moonNormalMap, // اضافه کردن جزئیات سه بعدی
    normalScale: new THREE.Vector2(2, 2),
    roughness: 0.8,
    metalness: 0.1,
    emissive: 0xffffff, // درخشش خود ماه
    emissiveMap: moonColorMap,
    emissiveIntensity: 0.4 // شدت درخشش سطحی
});
const moonGeo = new THREE.SphereGeometry(12, 64, 64);
const moon = new THREE.Mesh(moonGeo, moonMat);
moonGroup.add(moon);

// هاله (Glow) دور ماه
const glowGeo = new THREE.SphereGeometry(16, 64, 64);
const glowMat = new THREE.ShaderMaterial({
    uniforms: { 
        c: { type: "f", value: 0.4 },
        p: { type: "f", value: 4.0 },
        glowColor: { type: "c", value: new THREE.Color(0xffffee) },
        viewVector: { type: "v3", value: camera.position }
    },
    vertexShader: `
        uniform vec3 viewVector; uniform float c; uniform float p; varying float intensity;
        void main() {
            vec3 vNormal = normalize( normalMatrix * normal );
            vec3 vNormel = normalize( normalMatrix * viewVector );
            intensity = pow( c - dot(vNormal, vNormel), p );
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform vec3 glowColor; varying float intensity;
        void main() {
            vec3 glow = glowColor * intensity;
            gl_FragColor = vec4( glow, 1.0 );
        }
    `,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true
});
const glow = new THREE.Mesh(glowGeo, glowMat);
moonGroup.add(glow);

moonGroup.position.set(0, 80, -200);
scene.add(moonGroup);


// --- ۵. شفق قطبی (Aurora) ---
const auroraGeo = new THREE.PlaneGeometry(600, 150, 100, 64);
const auroraMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
        varying vec2 vUv; uniform float uTime;
        void main() {
            vUv = uv; vec3 pos = position;
            // موج‌های سینوسی ترکیبی برای حرکت طبیعی
            float wave = sin(pos.x * 0.02 + uTime * 0.3) * 20.0;
            wave += cos(pos.x * 0.05 + uTime * 0.1) * 10.0;
            pos.y += wave;
            pos.z += sin(pos.x * 0.05 + uTime * 0.2) * 40.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv; uniform float uTime;
        void main() {
            // ترکیب رنگ‌های سبز، آبی و بنفش
            vec3 c1 = vec3(0.0, 1.0, 0.7);
            vec3 c2 = vec3(0.5, 0.0, 1.0);
            vec3 color = mix(c1, c2, vUv.x + sin(uTime*0.5)*0.2);
            float alpha = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
            alpha *= 0.5 + 0.5 * sin(vUv.x * 50.0 + uTime);
            gl_FragColor = vec4(color, alpha * 0.7);
        }
    `
});
const aurora = new THREE.Mesh(auroraGeo, auroraMat);
aurora.position.set(0, 60, -180);
scene.add(aurora);


// --- ۶. ذرات معلق (ستاره و کرم شب‌تاب) ---
// کرم‌های شب‌تاب (زرد)
const ffGeo = new THREE.BufferGeometry();
const ffCount = 4000;
const ffPos = new Float32Array(ffCount * 3);
for(let i=0; i<ffCount*3; i+=3) {
    ffPos[i] = (Math.random()-0.5) * 600;
    ffPos[i+1] = Math.random() * 30; // نزدیک زمین
    ffPos[i+2] = (Math.random()-0.5) * 600;
}
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
const ffMat = new THREE.PointsMaterial({color: 0xffaa00, size: 0.6, transparent: true, blending: THREE.AdditiveBlending});
const fireflies = new THREE.Points(ffGeo, ffMat);
scene.add(fireflies);

// ستاره‌ها
const starsGeo = new THREE.BufferGeometry();
const starsCount = 5000;
const starsPos = new Float32Array(starsCount * 3);
for(let i=0; i<starsCount*3; i++) starsPos[i] = (Math.random()-0.5) * 1500;
starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
const starsMat = new THREE.PointsMaterial({color: 0xffffff, size: 2.0, map: starSprite, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false});
const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

// شهاب سنگ
const meteors = [];
const metGeo = new THREE.ConeGeometry(0.2, 10, 8); metGeo.rotateX(Math.PI/2);
const metMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.8});
function createMeteor() {
    const m = new THREE.Mesh(metGeo, metMat);
    const x=(Math.random()-0.5)*600; const y=Math.random()*100+100; const z=-Math.random()*300-100;
    m.position.set(x,y,z); m.lookAt(x-100, y-50, z); m.userData={speed:5+Math.random()*5, life:150};
    scene.add(m); meteors.push(m);
}
setInterval(createMeteor, 300);


// --- سیستم انیمیشن ---
const clock = new THREE.Clock();
const rocket = new THREE.Group();
const rBody = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 8), new THREE.MeshBasicMaterial({color:0xffaa00})); rBody.rotation.x=Math.PI/2;
const rLight = new THREE.PointLight(0xff8800, 5, 50); rocket.add(rBody, rLight); rocket.visible = false; scene.add(rocket);
const sparkTex = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/spark1.png');

let isFlying = false;

function animate() {
    const time = clock.getElapsedTime();
    
    // آپدیت شیدرها
    if(grassMat.userData.shader) grassMat.userData.shader.uniforms.uTime.value = time;
    auroraMat.uniforms.uTime.value = time;
    glowMat.uniforms.viewVector.value = new THREE.Vector3().subVectors(camera.position, glow.position);
    
    // حرکت آب
    water.material.normalMap.offset.x += 0.0005 * Math.sin(time*0.5);
    water.material.normalMap.offset.y += 0.0005 * Math.cos(time*0.5);
    
    // حرکت کرم‌های شب‌تاب
    fireflies.rotation.y = time * 0.02;
    fireflies.position.y = Math.sin(time * 0.5) * 2;

    // حرکت شهاب سنگ‌ها
    meteors.forEach((m, i) => { 
        m.translateZ(m.userData.speed); 
        m.userData.life--; 
        if(m.userData.life<=0){scene.remove(m); meteors.splice(i,1);} 
    });

    controls.update();

    if(isFlying) {
        const target = rocket.position.clone(); 
        target.z += 15; target.y += 3; 
        camera.position.lerp(target, 0.1); 
        camera.lookAt(rocket.position);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();


// --- پرتاب و موسیقی ---
const audioIntro = document.getElementById('audio-intro');
const audioLaunch = document.getElementById('audio-launch');
const btn = document.getElementById('launch-btn');
const uiIntro = document.querySelector('.intro-screen');
const uiFinal = document.querySelector('.final-screen');

document.body.addEventListener('click', () => { if(audioIntro.paused && !isFlying) { audioIntro.volume = 0.5; audioIntro.play(); }}, { once: true });

btn.addEventListener('click', () => {
    isFlying = true;
    controls.autoRotate = false;
    controls.enabled = false;
    
    gsap.to(audioIntro, { volume: 0, duration: 2, onComplete: () => audioIntro.pause() });
    audioLaunch.volume = 1; audioLaunch.play();

    gsap.to(uiIntro, { opacity: 0, duration: 1, pointerEvents: 'none', y: 50 });
    
    rocket.position.copy(camera.position); rocket.position.z -= 15; rocket.visible = true;
    
    // مقصد: بسیار نزدیک به سطح ماه برای دیدن جزئیات
    const targetPos = moonGroup.position.clone();
    targetPos.z += 15; // فاصله بسیار کم

    const path = new THREE.CatmullRomCurve3([
        rocket.position.clone(),
        new THREE.Vector3(0, 180, -100),
        targetPos
    ]);

    const flightData = { t: 0 };
    gsap.to(flightData, { t: 1, duration: 11, ease: "power2.inOut",
        onUpdate: () => {
            const pos = path.getPoint(flightData.t);
            rocket.position.copy(pos);
            rocket.lookAt(path.getPoint(Math.min(flightData.t + 0.01, 1)));
            if(Math.random()>0.2) createTrail(rocket.position);
        },
        onComplete: () => {
            rocket.visible = false; createExplosion(rocket.position);
            // دوربین آرام می‌گیرد
            gsap.to(camera.position, {
                x: targetPos.x, y: targetPos.y, z: targetPos.z + 30,
                duration: 4,
                onUpdate: () => camera.lookAt(moonGroup.position)
            });
            gsap.to(uiFinal, { opacity: 1, duration: 2, delay: 1.5 });
        }
    });
});

function createTrail(pos) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.3), new THREE.MeshBasicMaterial({color:0xffaa00, transparent:true}));
    p.position.copy(pos); p.position.x+=(Math.random()-0.5); scene.add(p);
    gsap.to(p.scale, {x:0,y:0,z:0,duration:0.6}); gsap.to(p.material, {opacity:0,duration:0.6,onComplete:()=>scene.remove(p)});
}

function createExplosion(pos) {
    const count=1000; const geo=new THREE.BufferGeometry(); const posArr=new Float32Array(count*3); const colArr=new Float32Array(count*3);
    const color=new THREE.Color(); const vels=[];
    for(let i=0;i<count;i++){
        posArr[i*3]=pos.x; posArr[i*3+1]=pos.y; posArr[i*3+2]=pos.z;
        color.setHSL(Math.random()*0.1+0.9, 1, 0.8); colArr[i*3]=color.r; colArr[i*3+1]=color.g; colArr[i*3+2]=color.b;
        const s=12+Math.random()*15; const t=Math.random()*Math.PI*2; const p=Math.acos(2*Math.random()-1);
        vels.push({x:s*Math.sin(p)*Math.cos(t), y:s*Math.sin(p)*Math.sin(t), z:s*Math.cos(p)});
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const mat=new THREE.PointsMaterial({size:3, map:sparkTex, vertexColors:true, blending:THREE.AdditiveBlending, transparent:true, depthWrite:false});
    const pts=new THREE.Points(geo, mat); scene.add(pts);
    const cl=new THREE.Clock();
    gsap.to({}, { duration: 5, onUpdate: () => {
        const dt=cl.getDelta(); const attr=geo.attributes.position;
        for(let i=0;i<count;i++){ vels[i].y-=5*dt; attr.setXYZ(i, attr.getX(i)+vels[i].x*dt, attr.getY(i)+vels[i].y*dt, attr.getZ(i)+vels[i].z*dt); }
        attr.needsUpdate=true; mat.opacity-=dt*0.2;
    }, onComplete:()=>scene.remove(pts)});
}

window.addEventListener('resize', () => { sizes.width=window.innerWidth; sizes.height=window.innerHeight; camera.aspect=sizes.width/sizes.height; camera.updateProjectionMatrix(); renderer.setSize(sizes.width, sizes.height); });