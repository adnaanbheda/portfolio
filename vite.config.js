import react from '@vitejs/plugin-react'
import { transformWithEsbuild } from 'vite'
import { compression } from 'vite-plugin-compression2'
import restart from 'vite-plugin-restart'

// `Experience` is loaded with React.lazy so the drei <Loader> can paint before
// the three.js bundle arrives. The cost is that the browser only discovers the
// scene chunks after the entry chunk has run. Emitting modulepreload links for
// them means they download in parallel with the entry instead of after it,
// keeping the fast first paint without paying for the extra round trip.
function preloadSceneChunks(names) {
    return {
        name: 'preload-scene-chunks',
        apply: 'build',
        transformIndexHtml: {
            order: 'post',
            handler(html, ctx) {
                if (!ctx.bundle) return html

                const files = Object.values(ctx.bundle)
                    .filter((chunk) => chunk.type === 'chunk' && names.includes(chunk.name))
                    .map((chunk) => chunk.fileName)

                // Already-injected entry preloads would otherwise be duplicated.
                const tags = files
                    .filter((file) => !html.includes(file))
                    .map((file) => ({
                        tag: 'link',
                        attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
                        injectTo: 'head',
                    }))

                return { html, tags }
            },
        },
    }
}

export default {
    root: 'src/',
    publicDir: '../public/',
    plugins:
    [
        // Restart server on static/public file change
        restart({ restart: [ '../public/**', ] }),

        // React support
        react(),

        preloadSceneChunks(['Experience', 'vendor-three', 'vendor-r3f', 'vendor-postprocessing']),

        // Precompress at build time so Nginx can serve .gz via gzip_static with
        // no per-request CPU on the Pi, at a better ratio than on-the-fly gzip.
        compression({
            algorithms: ['gzip'],
            threshold: 1024,
            include: [/\.(js|mjs|css|html|svg|json|ttf|glb|wasm)$/],
            deleteOriginalAssets: false,
        }),

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
        target: 'es2020', // Skip transpiling syntax every target browser already supports
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
