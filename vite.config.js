import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
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

// Lets the dev-only lighting panel save to src/moods.json. The dev server is open
// to the LAN, so only this machine may write, and the custom header stops another
// site's page in this browser from posting here.
function saveMoods() {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
    const sections = ['day', 'lightColours', 'night', 'planet', 'sky']

    return {
        name: 'save-moods',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/__save-moods', (request, response) => {
                const finish = (status, message) => {
                    response.statusCode = status
                    response.end(message)
                }

                const allowed = request.method === 'POST'
                    && request.headers['x-save-moods'] === '1'
                    && local.includes(request.socket.remoteAddress)
                if (!allowed) return finish(403, 'Saving is only open to this machine')

                let body = ''
                request.on('data', (chunk) => { body += chunk })
                request.on('end', async () => {
                    try {
                        const moods = JSON.parse(body)
                        if (Object.keys(moods).sort().join() !== sections.join()) return finish(400, 'Unexpected sections')
                        await writeFile(resolve(server.config.root, 'moods.json'), `${JSON.stringify(moods, null, 4)}\n`)
                        finish(200, 'Saved')
                    } catch (error) {
                        finish(400, error.message)
                    }
                })
            })
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

        saveMoods(),

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
