// Настоящий 3D Цезарь в Rive: модель из Magnific (Meshy), скелет 24 кости, два движения — хохот и удар.
// Скелет и скиннинг — из примера Rive (mesh_skin_as); здесь — текстурная отрисовка:
// каждый кадр вершины поворачиваются (лёгкий поворот на 3/4), проецируются с перспективой,
// треугольники сортируются от дальних к ближним (сортировка подсчётом по 1024 корзинам) и рисуются одной сеткой с текстурой.
import { Layout, Context } from "rive/host";
import { Renderer } from "rive/renderer";
import { BlendMode } from "rive/paint";
import { Vector } from "rive/vector";
import { Image, ImageSampler, ImageWrap, ImageFilter, VertexBuffer, TriangleBuffer } from "rive/image";
import { GLBLoader } from "./glb_loader";
import { SkeletalAnimation, Skeleton, AnimationClip } from "./skeletal_animation";

const BUCKETS: i32 = 1024;

export class Main extends Layout {
    @input blobName: string = "caesar";
    @input imageName: string = "tex";

    vertexCount: i32 = 0;
    triCount: i32 = 0;
    positions: StaticArray<f32> = new StaticArray<f32>(0);
    skinned: StaticArray<f32> = new StaticArray<f32>(0);
    sx: StaticArray<f32> = new StaticArray<f32>(0);
    sy: StaticArray<f32> = new StaticArray<f32>(0);
    sz: StaticArray<f32> = new StaticArray<f32>(0);
    indices: Array<i32> = [];
    joints: Array<i32> = [];
    weights: Array<f32> = [];
    skeleton: Skeleton? = null;
    clips: Array<AnimationClip> = [];
    time: f32 = 0;
    // сортировка: ключ треугольника, счётчики корзин, порядок
    keys: StaticArray<i32> = new StaticArray<i32>(0);
    counts: StaticArray<i32> = new StaticArray<i32>(BUCKETS + 1);
    order: StaticArray<i32> = new StaticArray<i32>(0);

    image: Image? = null;
    sampler: ImageSampler = ImageSampler(ImageWrap.clamp, ImageWrap.clamp, ImageFilter.bilinear);
    verts: VertexBuffer = new VertexBuffer();
    uvs: VertexBuffer = new VertexBuffer();
    tris: TriangleBuffer = new TriangleBuffer();

    cx: f32 = 0; cy: f32 = 0; cz: f32 = 0; modelH: f32 = 1;
    width: f32 = 360; height: f32 = 360;

    override init(context: Context): bool {
        this.image = context.image(this.imageName);
        let asset = context.blob(this.blobName);
        if (asset == null) return false;
        let result = GLBLoader.parse(asset);
        if (!result.success) return false;
        let glb = result.data!;
        let prim = glb.meshes[0].primitives[0];
        let pos = GLBLoader.readAccessorFloats(glb, prim.attribute("POSITION"));
        let uv = GLBLoader.readAccessorFloats(glb, prim.attribute("TEXCOORD_0"));
        if (pos == null || uv == null) return false;
        let n = pos.length / 3;
        this.vertexCount = n;
        this.positions = new StaticArray<f32>(n * 3 + 4);
        this.skinned = new StaticArray<f32>(n * 3 + 4);
        this.sx = new StaticArray<f32>(n); this.sy = new StaticArray<f32>(n); this.sz = new StaticArray<f32>(n);
        for (let i = 0; i < n * 3; i++) { this.positions[i] = pos[i]; this.skinned[i] = pos[i]; }
        for (let i = 0; i < n; i++) this.uvs.add(Vector(uv[i * 2], uv[i * 2 + 1]));
        let idx = GLBLoader.readIndices(glb, prim.indices);
        if (idx == null) return false;
        this.indices = idx;
        this.triCount = idx.length / 3;
        this.keys = new StaticArray<i32>(this.triCount);
        this.order = new StaticArray<i32>(this.triCount);
        // скелет и оба движения
        let joints = GLBLoader.readJoints(glb, prim.attribute("JOINTS_0"));
        let weights = GLBLoader.readAccessorFloats(glb, prim.attribute("WEIGHTS_0"));
        if (joints != null && weights != null) {
            this.joints = joints; this.weights = weights;
            let skeleton = SkeletalAnimation.buildSkeleton(glb, 0);
            if (skeleton != null) {
                this.skeleton = skeleton;
                for (let a = 0; a < glb.animations.length; a++) {
                    let clip = SkeletalAnimation.loadAnimation(glb, a, skeleton);
                    if (clip != null) this.clips.push(clip);
                }
            }
        }
        // центр и высота по позе покоя
        let minX: f32 = Infinity, maxX: f32 = -Infinity, minY: f32 = Infinity, maxY: f32 = -Infinity, minZ: f32 = Infinity, maxZ: f32 = -Infinity;
        for (let i = 0; i < n; i++) {
            let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
            minX = Mathf.min(minX, x); maxX = Mathf.max(maxX, x); minY = Mathf.min(minY, y); maxY = Mathf.max(maxY, y); minZ = Mathf.min(minZ, z); maxZ = Mathf.max(maxZ, z);
        }
        this.cx = (minX + maxX) / 2; this.cy = (minY + maxY) / 2; this.cz = (minZ + maxZ) / 2; this.modelH = maxY - minY;
        return true;
    }

    override resize(width: f64, height: f64, scale: f64): void {
        this.width = <f32>width; this.height = <f32>height;
    }

    override advance(seconds: f64): bool {
        this.time += <f32>Mathf.min(<f32>seconds, 0.05);
        let skeleton = this.skeleton;
        if (skeleton != null && this.clips.length > 0) {
            // хохот, потом удар, по кругу
            let t = this.time, k = 0, total: f32 = 0;
            for (let i = 0; i < this.clips.length; i++) total += this.clips[i].duration;
            t = t % total;
            while (k < this.clips.length - 1 && t >= this.clips[k].duration) { t -= this.clips[k].duration; k++; }
            SkeletalAnimation.sampleAnimation(skeleton, this.clips[k], t);
            SkeletalAnimation.updateSkeleton(skeleton);
            SkeletalAnimation.skinVertices(skeleton, this.positions, this.vertexCount, this.joints, this.weights, this.skinned);
        }
        this.project();
        return true;
    }

    private project(): void {
        let n = this.vertexCount;
        // лёгкий поворот на 3/4 и медленное покачивание камеры
        let yaw: f32 = -0.35 + 0.25 * Mathf.sin(this.time * 0.6);
        let c = Mathf.cos(yaw), s = Mathf.sin(yaw);
        let scale = this.height * 0.86 / this.modelH;
        let dist = this.modelH * 3.2;
        let ox = this.width / 2, oy = this.height * 0.52;
        let p = this.skinned;
        let zMin: f32 = Infinity, zMax: f32 = -Infinity;
        this.verts.reset();
        for (let i = 0; i < n; i++) {
            let x = p[i * 3] - this.cx, y = p[i * 3 + 1] - this.cy, z = p[i * 3 + 2] - this.cz;
            let rx = x * c + z * s, rz = -x * s + z * c;
            let f = dist / (dist - rz);
            let X = ox + rx * scale * f, Y = oy - y * scale * f;
            this.sx[i] = X; this.sy[i] = Y; this.sz[i] = rz;
            zMin = Mathf.min(zMin, rz); zMax = Mathf.max(zMax, rz);
            this.verts.add(Vector(X, Y));
        }
        // глубина треугольника → корзина (дальние — первыми)
        let idx = this.indices, tc = this.triCount, range = Mathf.max(zMax - zMin, 0.0001);
        for (let b = 0; b <= BUCKETS; b++) this.counts[b] = 0;
        for (let t = 0; t < tc; t++) {
            let a = idx[t * 3], b = idx[t * 3 + 1], d = idx[t * 3 + 2];
            let z = (this.sz[a] + this.sz[b] + this.sz[d]) / 3;
            let key = <i32>((z - zMin) / range * <f32>(BUCKETS - 1));
            this.keys[t] = key; this.counts[key + 1]++;
        }
        for (let b = 0; b < BUCKETS; b++) this.counts[b + 1] += this.counts[b];
        for (let t = 0; t < tc; t++) { let key = this.keys[t]; this.order[this.counts[key]] = t; this.counts[key]++; }
        this.tris.reset();
        for (let o = 0; o < tc; o++) {
            let t = this.order[o];
            this.tris.add(<u32>idx[t * 3], <u32>idx[t * 3 + 1], <u32>idx[t * 3 + 2]);
        }
    }

    override draw(renderer: Renderer): void {
        let image = this.image;
        if (image == null) return;
        renderer.drawImageMesh(image, this.sampler, this.verts, this.uvs, this.tris, BlendMode.srcOver, 1);
    }
}
