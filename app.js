import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { lookAt, flatten, perspective, vec3, vec4, mult, mat3, subtract, normalize, inverse, transpose, radians, mat4, translate, rotateX, rotateY, rotateZ, dot, length, add } from "../../libs/MV.js";
import { modelView, loadMatrix, multScale, pushMatrix, multTranslation, popMatrix } from "../../libs/stack.js";

import { GUI } from '../../libs/dat.gui.module.js'

import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js';
import * as TORUS from '../../libs/objects/torus.js';
import * as BUNNY from '../../libs/objects/bunny.js';

/** @type WebGLRenderingContext */
let gl;

function setup(shaders)
{
    //#region Main data
    let options = {
        backfaceCulling: true,
        depthTest: true
    }

    let camera = {
        eye: vec3(0, 5, 10),
        at: vec3(0, 0, 0),
        up: vec3(0, 1, 0),
        fovy: 55,
        near: 0.1,
        far: 40
    }

    let lights = {
        global: {
            active: true,
            ambient: vec3(100, 100, 100),
            diffuse: vec3(100, 100, 100),
            specular: vec3(100, 100, 100),
            position: vec4(-5, 5, -5, false),
            axis: vec3(0, -1, 0),
            aperture: 180,
            cutoff: 0
        },
        local: {
            active: true,
            ambient: vec3(50, 50, 100),
            diffuse: vec3(50, 50, 100),
            specular: vec3(50, 50, 100),
            position: vec4(5, 6, 0, true),
            axis: vec3(0, -5, 0),
            aperture: 180,
            cutoff: 0
        },
        spotlight: {
            active: true,
            ambient: vec3(0, 0, 0),
            diffuse: vec3(100, 100, 25),
            specular: vec3(100, 100, 25),
            position: vec4(0, 6, 5, true),
            axis: vec3(0, -4, -2),
            aperture: 20,
            cutoff: 4
        }
    }

    let materials = {
        ground: {
            Ka: vec3(112, 82, 44),
            Kd: vec3(112, 82, 44),
            Ks: vec3(112, 82, 44),
            shininess: 4.0,
        },
        cube: {
            Ka: vec3(189, 40, 40),
            Kd: vec3(189, 40, 40),
            Ks: vec3(255, 255, 255),
            shininess: 8.0,
        },
        cylinder: {
            Ka: vec3(45, 189, 40),
            Kd: vec3(45, 189, 40),
            Ks: vec3(255, 255, 255),
            shininess: 16.0,
        },
        torus: {
            Ka: vec3(47, 40, 189),
            Kd: vec3(47, 40, 189),
            Ks: vec3(255, 255, 255),
            shininess: 32.0,
        },
        bunny: {
            Ka: vec3(173, 148, 21),
            Kd: vec3(173, 148, 21),
            Ks: vec3(255, 255, 255),
            shininess: 64.0,
        },
    }
    //#endregion

    //#region Initialization
    let mProjection, mView;

    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    CUBE.init(gl);
    CYLINDER.init(gl);
    TORUS.init(gl);
    BUNNY.init(gl);

    let program = buildProgramFromSources(gl, shaders["phong.vert"], shaders["phong.frag"]);
    
    resize_canvas();
    window.addEventListener("resize", resize_canvas);
    window.requestAnimationFrame(render);

    function resize_canvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0, 0, canvas.width, canvas.height);
        updateMProjection();
        updateMView();
    }
    //#endregion

    //#region GUI
    function addVec(parentFolder, parentObject, childName) {
        let folder = parentFolder.addFolder(childName);
        let sub = [];
        let proxy = {}

        for (let i = 0; i < 3; i++) {
            proxy.__defineGetter__("xyz"[i], () => parentObject[childName][i]);
            proxy.__defineSetter__("xyz"[i], (v) => {parentObject[childName][i] = v});
            sub.push(folder.add(proxy, "xyz"[i], -20, 20));
        }

        if (parentObject[childName].length > 3) {
            proxy.__defineGetter__("w", () => parentObject[childName][3]);
            proxy.__defineSetter__("w", (v) => {parentObject[childName][3] = v});
            sub.push(folder.add(proxy, "w"));
        }

        return {
            updateDisplay() {
                for (let value of sub) {
                    value.updateDisplay();
                }
                return this;
            },
            onChange(callback) {
                for (let value of sub) {
                    value.onChange(callback);
                }
                return this;
            }
        };
    }

    const gui = new GUI();

    const guiOptions = gui.addFolder("Options");

    guiOptions.add(options, "backfaceCulling");
    guiOptions.add(options, "depthTest");

    const guiCamera = gui.addFolder("Camera");

    const guiCameraEye = addVec(guiCamera, camera, "eye").onChange(updateMView);
    addVec(guiCamera, camera, "at").onChange(updateMView);
    addVec(guiCamera, camera, "up").onChange(updateMView);
    guiCamera.add(camera, "fovy", 20, 160).onChange(updateMProjection);
    guiCamera.add(camera, "near", 0.1, 40).onChange(updateMProjection);
    guiCamera.add(camera, "far",  0.1, 40).onChange(updateMProjection);
    
    const guiLights = gui.addFolder("Lights");

    for (let [name, light] of Object.entries(lights)) {
        const guiLight = guiLights.addFolder(name);

        guiLight.add(light, "active");
        guiLight.addColor(light, "ambient");
        guiLight.addColor(light, "diffuse");
        guiLight.addColor(light, "specular");
        addVec(guiLight, light, "position");
        addVec(guiLight, light, "axis");
        guiLight.add(light, "aperture", 0, 180);
        guiLight.add(light, "cutoff", 0, 128);
    }

    const guiMaterials = gui.addFolder("Materials");

    for (let [name, material] of Object.entries(materials)) {
        const guiMaterial = guiMaterials.addFolder(name);

        guiMaterial.addColor(material, "Ka");
        guiMaterial.addColor(material, "Kd");
        guiMaterial.addColor(material, "Ks");
        guiMaterial.add(material, "shininess", 1.0, 128.0);
    }
    //#endregion

    //#region Drag camera
    let drag = {
        disabled: false,
        on: false,
        x: undefined,
        y: undefined,
        radius: undefined,
        prevPhi: undefined,
        prevTheta: undefined,
        curPhi: undefined,
        curTheta: undefined,
    }

    document.querySelector(".dg.ac").addEventListener("mouseenter", () => {
        drag.disabled = true
    })

    document.querySelector(".dg.ac").addEventListener("mouseleave", () => {
        drag.disabled = false
    })

    document.addEventListener("wheel", (evt) => {
        let dir = subtract(camera.eye, camera.at);
        drag.radius = length(dir);
        dir = normalize(dir);
        drag.radius += evt.deltaY / 100;
        drag.radius = Math.max(1.0, Math.min(drag.radius, 30.0))

        let radius = [drag.radius, drag.radius, drag.radius];

        camera.eye = add(camera.at, mult(dir, radius));
        guiCameraEye.updateDisplay();
        updateMView();
    })

    document.addEventListener("mousedown", (evt) => {
        if (drag.disabled) return;
        
        drag.x = evt.clientX;
        drag.y = evt.clientY;
        const dir = subtract(camera.eye, camera.at);
        drag.radius = length(dir);
        drag.prevPhi = Math.asin(dir[1] / drag.radius);
        drag.prevTheta = Math.asin(dir[0] / (drag.radius * Math.cos(drag.prevPhi)));
        if (dir[2] < 0)
            drag.prevTheta = Math.PI - drag.prevTheta;
        drag.on = true;
    })

    document.addEventListener("mousemove", (evt) => {
        if (!drag.on) return;

        drag.curTheta = drag.x - evt.clientX;
        drag.curPhi = evt.clientY - drag.y;

        drag.curTheta = 2 * Math.PI * (drag.curTheta / canvas.width) + drag.prevTheta;
        drag.curPhi = 2 * Math.PI * (drag.curPhi / canvas.height) + drag.prevPhi;
        drag.curPhi = Math.max(-Math.PI / 2, Math.min(drag.curPhi, Math.PI / 2));

        camera.eye[0] = camera.at[0] + drag.radius * Math.sin(drag.curTheta) * Math.cos(drag.curPhi);
        camera.eye[1] = camera.at[1] + drag.radius * Math.sin(drag.curPhi);
        camera.eye[2] = camera.at[2] + drag.radius * Math.cos(drag.curTheta) * Math.cos(drag.curPhi);
        guiCameraEye.updateDisplay();
        updateMView();
    })

    document.addEventListener("mouseup", () => {
        drag.on = false;
    })
    //#endregion

    //#region Utility functions
    function updateMView() {
        mView = lookAt(camera.eye, camera.at, camera.up);
    }

    function updateMProjection() {
        mProjection = perspective(camera.fovy, aspect, camera.near, camera.far);
    }

    function uploadUniform(locationName, obj, isInt = false) {
        let fi = isInt ? "i" : "f";
        let location = gl.getUniformLocation(program, locationName);

        if (obj.matrix) {
            gl[`uniformMatrix${obj.length}${fi}v`](location, false, flatten(obj));
        }
        else {
            obj = [obj].flat(1);
            gl[`uniform${obj.length}${fi}v`](location, obj);
        }
    }

    function uploadModelView()
    {
        uploadUniform("mModelView", modelView());
        uploadUniform("mNormals", inverse(transpose(modelView())));
    }

    function normalizeRGB(vec) {
        return vec.map(e => e / 255)
    }

    function uploadLights() {
        const keys = Object.keys(lights);

        uploadUniform("uNLights", keys.length, true);

        for (let i = 0; i < keys.length; i++) {
            let light = {...lights[keys[i]]};
            
            if (!light.active) {
                light.ambient = vec3(0, 0, 0);
                light.diffuse = vec3(0, 0, 0);
                light.specular = vec3(0, 0, 0);
            };
            
            const uploadLightUniform = (k, v) => uploadUniform(`uLights[${i}].${k}`, v);
            
            uploadLightUniform("ambient",  normalizeRGB(light.ambient));
            uploadLightUniform("diffuse",  normalizeRGB(light.diffuse));
            uploadLightUniform("specular", normalizeRGB(light.specular));
            uploadLightUniform("position", mult(mView, light.position));
            uploadLightUniform("axis",     vec3(mult(mView, vec4(light.axis, 0.0))));
            uploadLightUniform("aperture", radians(light.aperture));
            uploadLightUniform("cutoff",   light.cutoff);
        }
    }

    function uploadMaterial(material) {
        uploadUniform("uMaterial.Ka",        normalizeRGB(material.Ka));
        uploadUniform("uMaterial.Kd",        normalizeRGB(material.Kd));
        uploadUniform("uMaterial.Ks",        normalizeRGB(material.Ks));
        uploadUniform("uMaterial.shininess", material.shininess);
    }

    function drawBaseModel(model, material) {
        uploadMaterial(material);
        uploadModelView();
        model.draw(gl, program, gl.TRIANGLES);
    }
    //#endregion

    function Scene() {
        pushMatrix();
            multTranslation(vec3(0, -0.25, 0));
            multScale(vec3(10, 0.5, 10));
            drawBaseModel(CUBE, materials.ground);
        popMatrix();

        pushMatrix();
            multTranslation(vec3(-2, 1.0, -2));
            multScale(vec3(2, 2, 2));
            drawBaseModel(CUBE, materials.cube);
        popMatrix();

        pushMatrix();
            multTranslation(vec3(2, 1.0, -2));
            multScale(vec3(2, 2, 2));
            drawBaseModel(CYLINDER, materials.cylinder);
        popMatrix();
        
        pushMatrix();
            multTranslation(vec3(-2, 0.4, 2));
            multScale(vec3(2, 2, 2));
            drawBaseModel(TORUS, materials.torus);
        popMatrix();

        pushMatrix();
            multTranslation(vec3(2, 0, 2));
            multScale(vec3(15, 15, 15));
            drawBaseModel(BUNNY, materials.bunny);
        popMatrix();
    }

    function render()
    {
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);

        gl.cullFace(gl.BACK);
        
        if (options.backfaceCulling)
            gl.enable(gl.CULL_FACE);
        else
            gl.disable(gl.CULL_FACE);

        if (options.depthTest)
            gl.enable(gl.DEPTH_TEST);
        else
            gl.disable(gl.DEPTH_TEST);

        uploadUniform("mProjection", mProjection);
        uploadLights();

        loadMatrix(mView);
        Scene();
    }
}

const urls = ["phong.vert", "phong.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))
