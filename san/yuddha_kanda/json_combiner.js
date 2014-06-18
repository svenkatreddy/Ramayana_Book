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
	   data = data.yuddha_kanda.chapters[0];
	   
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


/*
var files = [
__dirname + '/chapter1.json',
__dirname + '/chapter2.json',
];
files.sort().forEach(printBr);

for(i=1;i<3;i++){
  (function(i){
	  
	  file[i] = __dirname + '/chapter'+i+'.json';
	  
	  console.dir(file[i]);
	  console.log("step 1 -> i = "+i);
	  fs.readFile(file[i], 'utf8', function (err, data) {
	    if (err) {
	      console.log('Error: ' + err);
	      return;
	    }

	    data = JSON.parse(data);

	    console.log("step 2 -> i = "+i);
	    stream = fs1.createWriteStream('chapters.json'); 
	    //console.log(stream);
	    stream.once('open', function(fd) {
	      console.log("step 3 -> i = "+i);

	      stream.write('"slokas" : [');
	  	  for(j=0;j<data.yuddha_kanda.chapters[0].slokas.length;j++){ //i-1
	  	    
	  	    temp = data.yuddha_kanda.chapters[0].slokas[j]; //i-1

	   	    stream.write(temp);
	  	    //stream.write("###Sanskrit ###\n\n\n");
	      }
	      stream.write(']');
	      stream.end();
	    });

	  console.log("step 4 -> i = "+i);

	  //console.dir(data);
	  });

  })(i);
}*/

function sanskrit_number(k) {
  var num =  k.toString();
  var mapObj = {
   '1':"१",
   '2':"२",
   '3':"३",
   '4':"४",
   '5':"५",
   '6':"६",
   '7':"७",
   '8':"८",
   '9':"९",
   '0':"०"
  };
  return replaceAll(num,mapObj);
}

function replaceAll(str,mapObj){
    var re = new RegExp(Object.keys(mapObj).join("|"),"gi");

    return str.replace(re, function(matched){
        return mapObj[matched.toLowerCase()];
    });
}

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
stream = fs1.createWriteStream('../yudhhakanda_all.json'); 
stream.once('open', function(fd) {
  stream.write('{\n\t"yuddha_kanda": { \n\t\t"sanskrit_name": "युद्धकाण्डम्",\n\t\t"chapters": [');
  stream.write(buffer);
  stream.write('\n\t\t]\n\t}\n}');
  stream.end();
});
}

 