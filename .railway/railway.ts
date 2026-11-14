import { defineRailway, project, service, volume } from "railway/iac";

const SINGAPORE = "asia-southeast1-eqsg3a";

export default defineRailway(() => {
  const progress = volume("bead-house-progress", {
    region: SINGAPORE,
    sizeMB: 500,
  });

  const web = service("bead-house", {
    start: "node server.js",
    healthcheck: "/healthz",
    healthcheckTimeout: 120,
    replicas: {
      [SINGAPORE]: 1,
    },
    env: {
      DATA_DIR: "/data",
      NODE_ENV: "production",
    },
    volumeMounts: {
      "/data": progress,
    },
  });

  return project("bead-house", {
    resources: [web, progress],
  });
});
