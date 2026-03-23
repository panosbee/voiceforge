import nextConfig from "eslint-config-next";

export default [
  { ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**"] },
  ...nextConfig,
  {
    rules: {
      "@next/next/no-page-custom-font": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
];
