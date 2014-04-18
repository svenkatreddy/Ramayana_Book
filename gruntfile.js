var path = require("path");

module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-gitbook');
    grunt.loadNpmTasks('grunt-gh-pages');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-http-server');

    grunt.initConfig({
        'gitbook': {
            english: {
                input: "./en",
                title: "Ramayana",
                description: "The Ramayana book.",
                github: "svenkatreddy/Ramayana_Book"
            },
            sanskrit: {
                input: "./san",
                title: "Ramayana",
                description: "The Ramayana book.",
                github: "svenkatreddy/Ramayana_Book"
            }
        },

        'gh-pages': {
            options: {
                base: '_book'
            },
            src: ['**']
        },
        'clean': {
            files: '_book'
        },
        'http-server': {
            'english': {
                // the server root directory
                root: './en/_book',

                port: 4000,
                host: "127.0.0.1",

                showDir : true,
                autoIndex: true,
                defaultExt: "html",

                //wait or not for the process to finish
                runInBackground: false
            },
            'sanskrit': {
                // the server root directory
                root: './san/_book',

                port: 4000,
                host: "127.0.0.1",

                showDir : true,
                autoIndex: true,
                defaultExt: "html",

                //wait or not for the process to finish
                runInBackground: false
            }
        }
    });

    grunt.registerTask('test', [
        'gitbook:english',
        'http-server:english'
    ]);

    grunt.registerTask('sanskrit', [
        'gitbook:sanskrit',
        'http-server:sanskrit'
    ]);

     grunt.registerTask('english', [
        'gitbook:english',
        'http-server:english'
    ]);

    grunt.registerTask('publish', [
        'gitbook',
        'gh-pages',
        'clean'
    ]);
    grunt.registerTask('default', 'gitbook');
};