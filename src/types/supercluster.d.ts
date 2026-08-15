// The `supercluster` package (v9+) ships no bundled types and is pure ESM
// with a genuine `export default class`. DefinitelyTyped's @types/supercluster
// describes the package's older CJS build (`export =`) — importing it as a
// namespace (`import * as Supercluster`) type-checks against those stale
// types but is NOT the actual constructor at runtime under real ESM
// resolution, causing a "not a constructor" crash. This local declaration
// matches the real runtime shape instead.
declare module "supercluster" {
  namespace Supercluster {
    interface Options<P, C> {
      minZoom?: number;
      maxZoom?: number;
      minPoints?: number;
      radius?: number;
      extent?: number;
      nodeSize?: number;
      log?: boolean;
      generateId?: boolean;
      map?: (props: P) => C;
      reduce?: (accumulated: C, props: Readonly<C>) => void;
    }

    type PointFeature<P> = GeoJSON.Feature<GeoJSON.Point, P>;

    interface ClusterProperties {
      cluster: true;
      cluster_id: number;
      point_count: number;
      point_count_abbreviated: string | number;
    }

    type ClusterFeature<C> = PointFeature<ClusterProperties & C>;
  }

  class Supercluster<P = GeoJSON.GeoJsonProperties, C = GeoJSON.GeoJsonProperties> {
    constructor(options?: Supercluster.Options<P, C>);
    load(points: Array<Supercluster.PointFeature<P>>): this;
    getClusters(
      bbox: [number, number, number, number],
      zoom: number
    ): Array<Supercluster.ClusterFeature<C> | Supercluster.PointFeature<P>>;
    getClusterExpansionZoom(clusterId: number): number;
    getChildren(clusterId: number): Array<Supercluster.ClusterFeature<C> | Supercluster.PointFeature<P>>;
    getLeaves(clusterId: number, limit?: number, offset?: number): Array<Supercluster.PointFeature<P>>;
  }

  export default Supercluster;
}
