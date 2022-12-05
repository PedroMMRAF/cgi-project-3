import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { lookAt, flatten, perspective, vec3, vec4, mult, mat3, subtract, normalize, inverse, transpose, radians, mat4, translate, rotateX, rotateY, rotateZ, dot } from "../../libs/MV.js";
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
            ambient: vec3(100, 100, 100),
            diffuse: vec3(100, 100, 100),
            specular: vec3(100, 100, 100),
            position: vec4(-5, 5, -5, 0),
            axis: vec3(0, -1, 0),
            aperture: 360,
            cutoff: 0
        },
        local: {
            ambient: vec3(50, 50, 100),
            diffuse: vec3(50, 50, 100),
            specular: vec3(50, 50, 100),
            position: vec4(5, 6, 0, 1),
            axis: vec3(0, -5.0, 0),
            aperture: 360,
            cutoff: 0
        },
        spotlight: {
            ambient: vec3(100, 100, 25),
            diffuse: vec3(100, 100, 25),
            specular: vec3(100, 100, 25),
            position: vec4(0, 6, 5, 1),
            axis: vec3(0, -1, -0.5),
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
            Kd: vec3(255, 255, 255),
            Ks: vec3(255, 255, 255),
            shininess: 8.0,
        },
        cylinder: {
            Ka: vec3(45, 189, 40),
            Kd: vec3(255, 255, 255),
            Ks: vec3(255, 255, 255),
            shininess: 16.0,
        },
        torus: {
            Ka: vec3(47, 40, 189),
            Kd: vec3(255, 255, 255),
            Ks: vec3(255, 255, 255),
            shininess: 32.0,
        },
        bunny: {
            Ka: vec3(173, 148, 21),
            Kd: vec3(255, 255, 255),
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
    //#endregion

    //#region Drag camera
    let drag = {
        on: false,
        x: undefined,
        y: undefined,
        radius: undefined,
        phi: undefined,
        theta: undefined,
    }

    document.addEventListener("mousedown", (evt) => {
        drag.x = evt.clientX;
        drag.y = evt.clientY;
        const dir = subtract(camera.eye, camera.at);
        drag.radius = Math.sqrt(dot(dir, dir));
        drag.phi = Math.asin(dir[1] / drag.radius);
        drag.theta = Math.asin(dir[0] / (drag.radius * Math.cos(drag.phi)));
        if (dir[2] < 0)
            drag.theta = Math.PI - drag.theta;
        drag.on = true;
    })

    document.addEventListener("mousemove", (evt) => {
        if (!drag.on) return;

        let theta = drag.x - evt.clientX;
        let phi = evt.clientY - drag.y;

        theta = 2 * Math.PI * (theta / canvas.width) + drag.theta;
        phi = 2 * Math.PI * (phi / canvas.height) + drag.phi;
        phi = Math.max(-Math.PI / 2, Math.min(phi, Math.PI / 2));

        camera.eye = [...camera.at];
        camera.eye[0] += drag.radius * Math.sin(theta) * Math.cos(phi);
        camera.eye[1] += drag.radius * Math.sin(phi);
        camera.eye[2] += drag.radius * Math.cos(theta) * Math.cos(phi);
        updateMView();
    })

    document.addEventListener("mouseup", () => {
        drag.on = false;
    })
    //#endregion

    //#region GUI
    function addVec3(parentFolder, parentObject, childName, onChange) {
        let folder = parentFolder.addFolder(childName);

        let proxy = {}

        for (let i = 0; i < 3; i++) {
            proxy.__defineGetter__("xyz"[i], () => parentObject[childName][i]);
            proxy.__defineSetter__("xyz"[i], (v) => {parentObject[childName][i] = v});
            folder.add(proxy, "xyz"[i], -20, 20).onChange(onChange).listen();
        }

        return [folder, proxy];
    }

    function addVec4(parentFolder, parentObject, childName, onChange) {
        let [folder, proxy] = addVec3(parentFolder, parentObject, childName);

        proxy.__defineGetter__("w", () => parentObject[childName][3]);
        proxy.__defineSetter__("w", (v) => {parentObject[childName][3] = v});
        folder.add(proxy, "w", [0, 1]).onChange(onChange).listen();
    }

    const gui = new GUI();

    const guiCamera = gui.addFolder("Camera");

    addVec3(guiCamera, camera, "eye", updateMView);
    addVec3(guiCamera, camera, "at", updateMView);
    addVec3(guiCamera, camera, "up", updateMView);
    guiCamera.add(camera, "fovy", 20, 160).onChange(updateMProjection);
    guiCamera.add(camera, "near", 0.1, 40).onChange(updateMProjection);
    guiCamera.add(camera, "far",  0.1, 40).onChange(updateMProjection);
    
    const guiLights = gui.addFolder("Lights");

    for (let [name, light] of Object.entries(lights)) {
        const guiLight = guiLights.addFolder(name);

        guiLight.addColor(light, "ambient");
        guiLight.addColor(light, "diffuse");
        guiLight.addColor(light, "specular");
        addVec4(guiLight, light, "position");
        addVec3(guiLight, light, "axis");
        guiLight.add(light, "aperture", 0, 360);
        guiLight.add(light, "cutoff", 0, 16);
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

    //#region Utility functions
    function updateMView() {
        mView = lookAt(camera.eye, camera.at, camera.up);
    }

    function updateMProjection() {
        mProjection = perspective(camera.fovy, aspect, camera.near, camera.far);
    }

    function resize_canvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0, 0, canvas.width, canvas.height);
        updateMProjection();
        updateMView();
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(
            gl.getUniformLocation(program, "mModelView"),
            false, flatten(modelView())
        );
        gl.uniformMatrix4fv(
            gl.getUniformLocation(program, "mNormals"),
            false, flatten(inverse(transpose(modelView())))
        );
    }

    function uploadProjection()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));
    }

    function uploadLights() {
        const keys = Object.keys(lights);

        gl.uniform1i(gl.getUniformLocation(program, "uNLights"), keys.length);

        for (let i = 0; i < keys.length; i++) {
            const sourceLight = lights[keys[i]];
            const norm = vec3(1/255, 1/255, 1/255);
            const light = {
                ambient: mult(sourceLight.ambient, norm),
                diffuse: mult(sourceLight.diffuse, norm),
                specular: mult(sourceLight.specular, norm),
                position: mult(mView, sourceLight.position),
                axis: vec3(mult(inverse(transpose(mView)), vec4(sourceLight.axis))),
                aperture: radians(sourceLight.aperture),
                cutoff: sourceLight.cutoff,
            }

            for (let [k, v] of Object.entries(light)) {
                v = [v].flat(1);
                gl[`uniform${v.length}fv`](
                    gl.getUniformLocation(program, `uLights[${i}].${k}`),
                    v
                );
            }
        }
    }

    function uploadMaterial(material) {
        const norm = vec3(1/255, 1/255, 1/255);
        material = {
            Ka: mult(material.Ka, norm),
            Kd: mult(material.Kd, norm),
            Ks: mult(material.Ks, norm),
            shininess: material.shininess
        }

        gl.uniform3fv(gl.getUniformLocation(program, "uMaterial.Ka"), material.Ka)
        gl.uniform3fv(gl.getUniformLocation(program, "uMaterial.Kd"), material.Kd)
        gl.uniform3fv(gl.getUniformLocation(program, "uMaterial.Ks"), material.Ks)
        gl.uniform1f(gl.getUniformLocation(program, "uMaterial.shininess"), material.shininess)
    }

    function Model(model, material) {
        uploadMaterial(material);
        uploadModelView();
        model.draw(gl, program, gl.TRIANGLES);
    }
    //#endregion

    function Scene() {
        pushMatrix();
            multTranslation(vec3(0, -0.25, 0));
            multScale(vec3(10, 0.5, 10));
            Model(CUBE, materials.ground);
        popMatrix();

        pushMatrix();
            multTranslation(vec3(-2, 1.0, -2));
            multScale(vec3(2, 2, 2));
            Model(CUBE, materials.cube);
        popMatrix();

        pushMatrix();
            multTranslation(vec3(2, 1.0, -2));
            multScale(vec3(2, 2, 2));
            Model(CYLINDER, materials.cylinder);
        popMatrix();
        
        pushMatrix();
            multTranslation(vec3(-2, 0.4, 2));
            multScale(vec3(2, 2, 2));
            Model(TORUS, materials.torus);
        popMatrix();

        pushMatrix();
            multTranslation(vec3(2, 0, 2));
            multScale(vec3(15, 15, 15));
            Model(BUNNY, materials.bunny);
        popMatrix();
    }

    function render()
    {
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);

        uploadProjection();

        loadMatrix(mView);

        uploadLights();

        Scene();
    }
}

const urls = ["phong.vert", "phong.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))