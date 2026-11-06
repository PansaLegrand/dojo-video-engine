import * as THREE from "three";
import { parseColorValue } from "@dojo-video-engine/schema/values";
import {
  evaluateThreeTransform,
  THREE_LIMITS,
  type ThreeScene,
  type ThreeObject,
} from "./schema.js";

type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** One revision owns its mutable scene. Drawing is synchronous through composition. */
export class ThreeLayerRuntime {
  private renderer: THREE.WebGLRenderer | undefined;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private readonly objects = new Map<string, THREE.Object3D>();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials = new Map<string, THREE.Material>();
  private disposed = false;

  constructor(
    private readonly params: ThreeScene,
    private readonly release: () => void,
  ) {
    this.camera =
      params.camera.kind === "perspective"
        ? new THREE.PerspectiveCamera(params.camera.fov, 1, 0.01, 50_000)
        : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50_000);
    try {
      for (const [id, material] of Object.entries(params.materials)) {
        const parsed = parseColorValue(material.color);
        if (!parsed) throw new Error("Invalid material color.");
        const alpha =
          parsed.kind === "rgba"
            ? parsed.alpha
            : parsed.name === "transparent"
              ? 0
              : 1;
        const color =
          parsed.kind === "rgba"
            ? new THREE.Color().setRGB(
                parsed.red / 255,
                parsed.green / 255,
                parsed.blue / 255,
                THREE.SRGBColorSpace,
              )
            : new THREE.Color(
                parsed.name === "transparent" ? "black" : parsed.name,
              );
        const opacity = material.opacity * alpha;
        const options = {
          color,
          opacity,
          transparent: opacity < 1,
          side: THREE.DoubleSide,
        };
        this.materials.set(
          id,
          material.unlit
            ? new THREE.MeshBasicMaterial(options)
            : new THREE.MeshStandardMaterial({
                ...options,
                roughness: material.roughness,
                metalness: material.metalness,
              }),
        );
      }
      for (const [id, object] of Object.entries(params.objects)) {
        let native: THREE.Object3D;
        if (object.kind === "mesh") {
          const geometry = createGeometry(object.geometry);
          this.geometries.push(geometry);
          const material = this.materials.get(object.materialId);
          if (!material)
            throw new Error(`Missing material ${object.materialId}.`);
          native = new THREE.Mesh(geometry, material);
        } else native = new THREE.Group();
        native.name = id;
        this.objects.set(id, native);
      }
      for (const [id, object] of Object.entries(params.objects)) {
        const native = this.objects.get(id);
        const parent = object.parentId
          ? this.objects.get(object.parentId)
          : this.scene;
        if (!native || !parent)
          throw new Error("Invalid Three.js object hierarchy.");
        parent.add(native);
      }
      this.scene.add(new THREE.AmbientLight(0xffffff, params.lighting.ambient));
      const light = new THREE.DirectionalLight(
        0xffffff,
        params.lighting.intensity,
      );
      light.position.set(
        params.lighting.position.x,
        params.lighting.position.y,
        params.lighting.position.z,
      );
      this.scene.add(light);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  draw(context: Context, width: number, height: number, time: number): void {
    if (this.disposed)
      throw new Error("Three.js resources have been disposed.");
    if (width <= 0 || height <= 0) return;
    const transform = context.getTransform();
    const pixelsX = Math.max(
      1,
      Math.ceil(width * Math.hypot(transform.a, transform.b)),
    );
    const pixelsY = Math.max(
      1,
      Math.ceil(height * Math.hypot(transform.c, transform.d)),
    );
    if (
      pixelsX * pixelsY > THREE_LIMITS.pixels ||
      pixelsX > 4096 ||
      pixelsY > 4096
    )
      throw new Error(
        "Three.js layer exceeds its 4K surface budget; reduce the output or layer size.",
      );
    if (!this.renderer) {
      if (typeof document === "undefined")
        throw new Error(
          "Three.js layers require a main-thread browser with WebGL2.",
        );
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      });
      if (!gl)
        throw new Error(
          "WebGL2 is unavailable. Enable hardware acceleration or use a supported browser.",
        );
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas,
          context: gl,
          alpha: true,
          antialias: true,
        });
        this.renderer.setPixelRatio(1);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.NoToneMapping;
      } catch (error) {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        throw error;
      }
    }
    const renderer = this.renderer;
    if (renderer.getContext().isContextLost())
      throw new Error(
        "The Three.js WebGL context was lost. Retry preview or export.",
      );
    if (
      renderer.domElement.width !== pixelsX ||
      renderer.domElement.height !== pixelsY
    )
      renderer.setSize(pixelsX, pixelsY, false);
    for (const [id, object] of Object.entries(this.params.objects)) {
      const native = this.objects.get(id);
      if (!native) throw new Error(`Missing object ${id}.`);
      const state = evaluateThreeTransform(object, time);
      native.position.set(state.position.x, state.position.y, state.position.z);
      native.rotation.set(
        THREE.MathUtils.degToRad(state.rotation.x),
        THREE.MathUtils.degToRad(state.rotation.y),
        THREE.MathUtils.degToRad(state.rotation.z),
      );
      native.scale.set(state.scale.x, state.scale.y, state.scale.z);
    }
    const camera = this.params.camera,
      position = camera.position,
      target = camera.target;
    const angle = THREE.MathUtils.degToRad(
      camera.orbit
        ? camera.orbit.phase + camera.orbit.degreesPerSecond * time
        : 0,
    );
    const dx = position.x - target.x,
      dz = position.z - target.z;
    this.camera.position.set(
      target.x + dx * Math.cos(angle) + dz * Math.sin(angle),
      position.y,
      target.z - dx * Math.sin(angle) + dz * Math.cos(angle),
    );
    this.camera.lookAt(target.x, target.y, target.z);
    if (this.camera instanceof THREE.PerspectiveCamera)
      this.camera.aspect = width / height;
    else {
      this.camera.top = camera.size / 2;
      this.camera.bottom = -camera.size / 2;
      this.camera.right = (camera.size * width) / height / 2;
      this.camera.left = -this.camera.right;
    }
    this.camera.updateProjectionMatrix();
    renderer.render(this.scene, this.camera);
    // Consume immediately: no asynchronous boundary may allow another frame to replace it.
    context.drawImage(renderer.domElement, 0, 0, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.scene.clear();
    this.objects.clear();
    this.materials.clear();
    this.geometries.length = 0;
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = undefined;
    this.release();
  }
}

function createGeometry(
  geometry: Extract<ThreeObject, { kind: "mesh" }>["geometry"],
): THREE.BufferGeometry {
  switch (geometry.kind) {
    case "box":
      return new THREE.BoxGeometry(
        geometry.width,
        geometry.height,
        geometry.depth,
      );
    case "sphere":
      return new THREE.SphereGeometry(geometry.radius, 24, 16);
    case "cylinder":
      return new THREE.CylinderGeometry(
        geometry.radiusTop,
        geometry.radiusBottom,
        geometry.height,
        24,
      );
    case "torus":
      return new THREE.TorusGeometry(geometry.radius, geometry.tube, 12, 32);
    case "triangles": {
      const result = new THREE.BufferGeometry();
      result.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(geometry.positions, 3),
      );
      result.computeVertexNormals();
      return result;
    }
  }
}
