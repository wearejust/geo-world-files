var tj = require('togeojson'),
    fs = require('fs')
    cluster = require('cluster')
    JSONStream = require("JSONStream").stringifyObject("{",",","}")
    colors = require("colors");


    const numCPUs = require('os').cpus().length;
    var countries = JSON.parse(fs.readFileSync('./geodata/countries.json', 'utf8'));
    DOMParser = require('xmldom').DOMParser;

Object.defineProperty(Array.prototype, 'chunk', {
    value: function(chunkSize){
        var temporal = [];
        
        for (var i = 0; i < this.length; i+= chunkSize){
            temporal.push(this.slice(i,i+chunkSize));
        }
                
        return temporal;
    }
});

if (cluster.isMaster) 
{
    var workers = [];
    var compileList = [];

    countries.forEach((item) => {

        var path = './geodata/' + item.cca3;
        var exportPath = './exported/' + item.cca3;
        levels = [0,1,2,3,4,5];

        if (fs.existsSync(path)) {

            levels.forEach((level) => {
                var exportFile =  `./exported/${item.cca3}/level_${level}.geojson`;
                var levelFile = `./geodata/${item.cca3}/level_${level}.kml`;
                if(!fs.existsSync(exportFile) && fs.existsSync(levelFile)){
                    compileList.push({
                        source: levelFile,
                        target: exportFile,
                        folder: exportPath
                    });
                }
            });
            
        }
    });

    var chunkList = compileList.chunk(compileList.length / numCPUs);

    if(chunkList.length > 0) {
        
        console.log('Master cluster setting up ' + numCPUs + ' workers...');

        for (var i = 0; i < numCPUs; i++) {
            const worker = cluster.fork();
            workers.push(worker);

            worker.on('message', function(message) {
                console.log(message.from + ': ' + message.type + ' ' + message.data.number + ' = ' + message.data.result);
            });
            
            worker.send(chunkList[i]);
        }

    } else {
        console.log('No exports to be done.');
    }
    

	cluster.on('online', function(worker) {
		console.log('Worker ' + worker.process.pid + ' is online');
    });

} else {
    
    process.on('message', function(exports) {

        exports.forEach(toExport => {
            try {
                console.log(colors.yellow(`Exporting ${toExport.source}`));

                var kml = new DOMParser().parseFromString(fs.readFileSync(toExport.source, 'utf8'));
                var convertedWithStyles = tj.kml(kml, { styles: true });
        
                if(convertedWithStyles) {

                    let data = JSON.stringify(convertedWithStyles);  

                    if(!fs.existsSync(toExport.folder)){
                        fs.mkdirSync(toExport.folder);
                        console.log(colors.yellow(`Created folder ${toExport.folder}.`));
                    }

                    fs.writeFileSync(toExport.target, data);  

                    // fs.writeFileSync(toExport.target, JSON.stringify(convertedWithStyles) , 'utf-8');
                    console.log(colors.green(`Exported ${toExport.target}.`));    
                }    
            } catch(err) {
                console.log(colors.red(toExport, err));
            }

        });
        process.exit();
    });
}