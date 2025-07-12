// Script to analyze the webpack bundle
// Run with: node analyze-bundle.js

const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const webpack = require('webpack');
const config = require('react-scripts/config/webpack.config');

// Get the production config
const webpackConfig = config('production');

// Add bundle analyzer plugin
webpackConfig.plugins.push(
  new BundleAnalyzerPlugin({
    analyzerMode: 'server',
    analyzerPort: 8888,
    openAnalyzer: true
  })
);

// Run webpack
webpack(webpackConfig, (err, stats) => {
  if (err) {
    console.error(err);
    return;
  }

  console.log(stats.toString({
    chunks: false,
    colors: true
  }));
});