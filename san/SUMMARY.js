var fs = require('fs');
var fs1 = require('fs');
var file,stream,temp;
 
	  
	  file = __dirname + '/SUMMARY.json';
	  

	  fs.readFile(file, 'utf8', function (err, data) {
	    if (err) {
	      console.log('Error: ' + err);
	      return;
	    }

	    data = JSON.parse(data);

	    stream = fs1.createWriteStream('SUMMARY.md');
	    //console.log(stream);
	    stream.once('open', function(fd) {

	      stream.write("रामायणम्\n=========\n\n\n");

	  	  for(i=0;i<data.books.length;i++){
	  	    
	  	    stream.write("* ["+data.books[i].sanskrit_name+ " - "+data.books[i].name+" Kanda ]("+data.books[i].name+"_kanda/README.md)\n");
	  	    
	  	    for(j=0;j<data.books[i].total_chapters;j++) {

	  	    	stream.write("    * [सर्गः " + sanskrit_number((j+1)) +" - Chapter "+ (j+1) +" ]("+data.books[i].name+"_kanda/chapter"+(j+1)+".md)\n");
	  	    }

	  	  }
	      stream.end();
	    });

	  console.dir(data);
	  });


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