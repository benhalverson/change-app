import 'three';

declare module 'three' {
  interface BufferGeometry {
    __originalBBox?: Box3;
  }
}
