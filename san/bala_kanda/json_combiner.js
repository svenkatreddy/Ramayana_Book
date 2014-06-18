var fs = require('fs');
var fs1 = require('fs');
var fs2 = require('fs');
var file=[],stream=[],temp;
var buffer="",count = 0;

fs.readdir(__dirname, function(err, files) {
	var allfiles = files.filter(function(file) { return file.substr(-5) == '.json'; }).sort(sortAlphaNum);
	count = allfiles.length;

	allfiles.forEach(function(file, key) {
      fs.readFile(file, 'utf8', function (err, data) {
	    if (err) {
	      console.log('Error: ' + err);
	      return;
	    }
	   data = JSON.parse(data);
	   data = data.balakanda.chapters[0];
	   
	   if(data.chapter_number ==  count) {
	   	buffer = buffer + "\n\t\t\t" + JSON.stringify(data);
	   	console.log("last file is"+count);
	   	writetoFile(buffer);
	   }
	   else {
	   	buffer = buffer + "\n\t\t\t" + JSON.stringify(data)+",";
	   }

	   });
    });
});


var reA = /[^a-zA-Z]/g;
var reN = /[^0-9]/g;
function sortAlphaNum(a,b) {
    var aA = a.replace(reA, "");
    var bA = b.replace(reA, "");
    if(aA === bA) {
        var aN = parseInt(a.replace(reN, ""), 10);
        var bN = parseInt(b.replace(reN, ""), 10);
        return aN === bN ? 0 : aN > bN ? 1 : -1;
    } else {
        return aA > bA ? 1 : -1;
    }
}

function writetoFile(buffer) {
//console.log("buffer is "+buffer);
stream = fs1.createWriteStream('../balakanda_all.json'); 
stream.once('open', function(fd) {
  stream.write('{\n\t"balakanda": { \n\t\t"sanskrit_name": "बालकाण्डम्",\n\t\t"chapters": [');
  stream.write(buffer);
  stream.write('\n\t\t]\n\t}\n}');
  stream.end();
});
}

 