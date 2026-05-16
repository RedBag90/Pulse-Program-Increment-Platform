/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "auth",
        "admin",
        "portfolio",
        "art",
        "pi",
        "team",
        "dependencies",
        "reporting",
        "integrations",
        "domain",
        "server",
        "db",
        "i18n",
        "ci",
        "docs",
        "config",
        "release",
      ],
    ],
  },
};

export default config;
