// /api/benchmarks/settings delegates to the same logic as /api/benchmarks/targets
// This route exists because the client hook calls /api/benchmarks/settings
export { GET, PATCH } from '../targets/route';
