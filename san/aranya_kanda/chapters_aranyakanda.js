var fs = require('fs');
var fs1 = require('fs');
var file=[],stream=[],temp;
 

for(i=1;i<76;i++){
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
	    stream[i] = fs1.createWriteStream('chapter'+i+'.md');
	    //console.log(stream);
	    stream[i].once('open', function(fd) {
	      console.log("step 3 -> i = "+i);
	      stream[i].write(data.aranyakanda.sanskrit_name+"\n");
	      stream[i].write("===============================\n\n\n");

	      stream[i].write("## Chapter "+i +"  / सर्गः "+sanskrit_number(i)+"##\n\n\n");

	  	  for(j=0;j<data.aranyakanda.chapters[0].slokas.length;j++){ //i-1
	  	    
	  	    temp = data.aranyakanda.chapters[0].slokas[j]; //i-1

	  
	   	    stream[i].write("###Slōka "+(j+1)+"###\n\n\n");
	  	    //stream.write("###Sanskrit ###\n\n\n");
	  	
	  	    if(temp.indexOf("|") || temp.indexOf("।") ){
		      temp = temp.replace('|', '|\n    ');
		      temp = temp.replace('।','।\n    ')
		    }
	  	    stream[i].write("    "+temp+"\n\n\n");
	      }
	      stream[i].end();
	    });

	  console.log("step 4 -> i = "+i);

	  console.dir(data);
	  });

  })(i);
}

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
 