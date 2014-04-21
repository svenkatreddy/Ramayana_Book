var path = require("path");

module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-gitbook');
    grunt.loadNpmTasks('grunt-gh-pages');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-http-server');
    grunt.loadNpmTasks('grunt-contrib-copy');

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
                base: 'san_book'
            },
            src: ['/san/_book/**/*']
        },
        'clean': {
            files:'*_book'
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
        },

        copy: {
         sanskrit: {
            files: [
              // includes files within path
              {
                expand: true,
                cwd: 'san/_book/',
                src: ['**/**','!SUMMARY.js','!*kanda/*.json','!*kanda/chapters*.js'], 
                dest: 'san_book/'
              }
            ]
          },
          english: {
            files: [
              // includes files within path
              {
                expand: true,
                cwd: 'en/_book/',
                src: ['**/**','!SUMMARY.js','!*kanda/*.json','!*kanda/chapters*.js'], 
                dest: 'en_book/'
              }
            ]
          }
        }

    });


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
        'clean',
        'copy:sanskrit'    
    ]);

    grunt.registerTask('default', 'gitbook');
};