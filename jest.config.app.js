module.exports = {
    preset: "jest-expo",
    setupFilesAfterEnv: ["<rootDir>/test/app/setup.tsx"],
    testMatch: ["<rootDir>/test/app/**/*.test.ts?(x)"],
    clearMocks: true,
};
