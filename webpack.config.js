/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

"use strict";

const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {VueLoaderPlugin} = require('vue-loader');
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');

const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

let webpackMode = 'production';
if (process.env.NODE_ENV === 'local' || process.env.NODE_ENV === 'development') {
    webpackMode = 'development';
}

let commonConfig = {
    devtool: 'inline-source-map',
    mode: webpackMode,
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        alias: {
            vue: 'vue/dist/vue.esm.js'
        }
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                options: {
                    appendTsSuffixTo: [/\.vue$/]
                },
                exclude: /(node_modules)/
            },
            {
                test: /\.vue$/,
                loader: 'vue-loader',
            },
            {
                test: /\.html$/,
                use: {
                    loader: 'html-loader',
                    options: {
                        attrs: [':data-src']
                    }
                }
            },
            {
                test: /\.(css)$/,
                loader: 'file-loader',
                options: {
                    name: 'build/[name].[ext]'
                }
            },
            {
                test: /\.(ttf|woff|woff2|eot)$/,
                loader: 'file-loader',
                options: {
                    name: 'fonts/[name].[ext]'
                }
            },
            {
                test: /\.(png|jpg|gif|svg)$/,
                loader: 'file-loader',
                options: {
                    name: 'images/[name].[ext]'
                }
            },
            {
                test: /\.scss$/,
                use: [{
                        loader: 'file-loader',
                        options: {
                            name: 'build/app.css',
                        }
                    },
                    'extract-loader',
                    'css-loader?-url',
                    'postcss-loader',
                    'sass-loader']
            },
            {
                test: /\.(md|MD)$/,
                use: [{
                        loader: 'file-loader',
                        options: {
                            name: 'build/changelog.html'
                        }
                    },
                    'extract-loader',
                    "html-loader",
                    "markdown-loader"
                ]
            }
        ]
    }
};

require('dotenv').config({path: __dirname + '/.env.' + process.env.NODE_ENV});

process.env.VERSION = require("./package.json").version;

let defineNodeEnv = {};
for (const prop in process.env) {
    defineNodeEnv["process.env." + prop] = JSON.stringify(process.env[prop]);
}

const plugins = [
    new HtmlWebpackPlugin({
        filename: 'index.html',
        template: '!!underscore-template-loader!./index.html',
        hash: new Date().getTime(),
        inject: false
    }),
    new CopyWebpackPlugin([
        // "./index.html",
        {from: "./locale", to: "./locale"},
        {from: "./deployed", to: "./deployed"},
        // {from: "./node_modules/leaflet/dist/images", to: "./build/images"},
    ]),
    new VueLoaderPlugin(),
    new webpack.DefinePlugin(defineNodeEnv)
];



if (webpackMode === 'production') {
    commonConfig = Object.assign({}, commonConfig, {
        optimization: {
            minimizer: [
                new UglifyJsPlugin({
                    uglifyOptions: {
                        output: {
                            comments: false
                        }
                    }
                })
            ],
            splitChunks: {
                chunks: 'all'
            }
        }
    });

    plugins.push({
        apply: (compiler) => {
            compiler.hooks.afterEmit.tap('AfterEmitPlugin', (compilation) => {
                const appPath = `${__dirname}/dist/build/app.js`;
                const jsContent = fs.readFileSync(appPath).toString();
                const obfuscatedContent = JavaScriptObfuscator.obfuscate(jsContent, {
                    compact: true,
                    controlFlowFlattening: true,
                    deadCodeInjection: true,
                    deadCodeInjectionThreshold: 0.10,
                    domainLock: ['dcity.surge.sh', 'app.yalland.com', 'yalland.com'],
                    selfDefending: true
                });
                fs.writeFile(appPath, obfuscatedContent.getObfuscatedCode(), () => {
                    process.stdout.write("✅ Obfuscated app.js\n")
                });
            });
        }
    });
}

const UIThread = Object.assign({}, commonConfig, {
    name: "GaltProject UI",
    //https://github.com/vuematerial/vue-material/issues/1182#issuecomment-345764031
    entry: {
        'babel-polyfill': 'babel-polyfill',
        'app.js': './src/main.ts',
        // 'changelog.temp': './CHANGELOG.MD'
    },
    output: {
        filename: './build/[name]'
    },
    plugins
});

module.exports = [UIThread];
