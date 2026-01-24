import react from '@vitejs/plugin-react'
import { transformWithEsbuild } from 'vite'
import restart from 'vite-plugin-restart'

export default {
    root: 'src/',
    publicDir: '../public/',
    plugins:
    [
        // Restart server on static/public file change
        restart({ restart: [ '../public/**', ] }),

        // React support
        react(),

        // .js file support as if it was JSX
        {
            name: 'load+transform-js-files-as-jsx',
            async transform(code, id)
            {
                if (!id.match(/src\/.*\.js$/))
                    return null

                return transformWithEsbuild(code, id, {
                    loader: 'jsx',
                    jsx: 'automatic',
                });
            },
        },
    ],
    server:
    {
        host: true, // Open to local network and display URL
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env), // Open if it's not a CodeSandbox
        watch: {
            usePolling: true, // Enables file polling
        }
    },
    build:
    {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: false, // Disable sourcemaps in production for better performance
        rollupOptions: {
            output: {
                manualChunks: {
                    // React core
                    'vendor-react': ['react', 'react-dom'],
                    // Three.js core
                    'vendor-three': ['three'],
                    // R3F ecosystem
                    'vendor-r3f': ['@react-three/fiber', '@react-three/drei'],
                    // Post-processing effects
                    'vendor-postprocessing': ['@react-three/postprocessing', '@react-spring/three'],
                    // Analytics
                    'vendor-analytics': ['react-ga4']
                }
            }
        },
        // Optimize asset handling
        assetsInlineLimit: 4096, // Inline assets smaller than 4kb
        chunkSizeWarningLimit: 1000,
        // Enable minification
        minify: 'esbuild',
        terserOptions: {
            compress: {
                drop_console: true, // Remove console.logs in production
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info']
            }
        }
    },
}