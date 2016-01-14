var express = require('express');
var app = express();
var fs = require("fs");
var async = require('async')
var router = express.Router();
var md5 = require('MD5');
var plist = require('plist');

var path = require('path');
var mime = require('mime');

var bodyParser = require('body-parser');
var multer  = require('multer');
var upload = multer({ dest: '/uploads/' });

var db_file = "./test.db";
var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database(db_file);

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(multer({ dest: '/uploads/'}).single('file'));

app.get('/', function (req, res) {
   res.sendFile( __dirname + "/" + "download.html" );
})

db.serialize(function() {
	//如果 UploadFile 資料表不存在，那就建立 UploadFile 資料表
	db.run("CREATE TABLE IF NOT EXISTS  UploadFile(file_id TEXT, file_type TEXT, version TEXT, date TEXT, intro TEXT, download_url TEXT)");
});

app.get('/file_list', function (req, res) {

	var files = {
		'android':[], 
		'ios':[], 
		'web':[]
	};
	
	var query_sql = "SELECT * FROM UploadFile";

	async.series([
	    function (callback) {
	        db.each(query_sql, 
	        	function(err, row) {
		        	for(var key in files){
				 		if(key == row.file_type){
				 			files[key].push({
				 				'id': row.file_id,
				 				'platform': row.file_type,
					 			'version': row.version,
						 		'create_time': row.date,
						 		'intro': row.intro,
						 		'download_url': row.download_url,
						 		'plist_url': "itms-services://?action=download-manifest&" + 
						 			"url=https://apserver.mitake.com.tw/plist/" +
						 			row.file_id + ".plist"
						 	});
				 		}
					}
    			},
    			function (err, cntx) {     
	                callback();
	            }
    		);
	    },
	    function (callback) {
	    	res.setHeader('Content-Type', 'application/json');
			res.send(JSON.stringify(files));
	    }
	])
})

app.get('/upload', function (req, res) {
   res.sendFile( __dirname + "/" + "upload.html" );
})


app.post('/upload', function(req, res, next){

	console.log(req);

	var origin_name = req.file.originalname;
	var file_format = req.file.originalname.slice(origin_name.lastIndexOf("."));
	var file_id = md5(req.body.version);

	handleDB(req, file_format);
	
	if(req.body.type == 'ios'){
		generatePlist(file_id);
	}

	var path = __dirname + "/file_storage/" + req.body.type + '/' + file_id + file_format;

	fs.readFile( req.file.path, function (err, data) {
        fs.writeFile(path, data, function (err) {
	        if( err ){
	            console.log(err);
	        }else{
	            response = {
	                message:'File uploaded successfully',
	                filename:origin_name
	            };
	        }
	        console.log(response);
	        res.end(JSON.stringify(response));
	    });
    });
});

var handleDB = function(data, file_format){
	var file_id = md5(data.body.version);
	var file_type = data.body.type;
	var version = data.body.version;
	var date = parseIsoTime();
	var intro = data.body.intro;
	var download_url = "/file_download?download_type=" + file_type +
    		"&file_id=" + file_id + "&file_type=" + file_format.slice(1);

    var inspect_sql = "SELECT * FROM UploadFile WHERE version='" + 
    	version + "' AND file_type='" + file_type + "'";

    var upload_sql = "INSERT INTO UploadFile(file_id, file_type, version, date, intro, download_url) VALUES (?,?,?,?,?,?)";

	db.get(inspect_sql, function(err, row) {
	    if (row !== undefined) {
			console.log("table exists. cleaning existing records");
			db.run("DELETE FROM UploadFile", function(error) {
				if (error)
					console.log(error);
			});
		}
		db.run(upload_sql,[file_id, file_type, version, date, intro, download_url]);
	});

};

var generatePlist = function(file_id){
	console.log('sadasions');

	var plist_path = __dirname + "/public/plist/" + file_id + ".plist";
	var plist_data = plist.build({ 
		items: [
			{
				assets: [
					{
						kind: "software-package",
						url: plist_path
					}
				],
				metadata:{
					"bundle-identifier": "tw.com.mitake.cloud.projecto",
					"bundle-version": "1.0",
					"kind": "software",
					"title": "Co+"
				}

			}

		] 
	});

	fs.writeFile(plist_path, plist_data, function (err) {
        if( err ){
            console.log(err);
        }
    });

};



app.get('/file_download', function(req, res){

	var type = req.query.download_type;
	var file_name = req.query.file_id;
	var format = req.query.file_type;

  	var file = __dirname + '/file_storage/' + type + '/' + file_name + '.' + format;

  	var filename = path.basename(file);
	var mimetype = mime.lookup(file);

	res.setHeader('Content-disposition', 'attachment; filename=' + filename);
	res.setHeader('Content-type', mimetype);

	var filestream = fs.createReadStream(file);
	filestream.pipe(res);
});

app.put('/update_info', function(req, res){
	var origin_name = req.file.originalname;
	var file_format = req.file.originalname.slice(origin_name.lastIndexOf("."));
	var file_type = req.body.type;
	var file_id = req.body.file_id;
	var version = req.body.version;
	var date = parseIsoTime();
	var title = req.body.title;
	var detail = req.body.description;
	var url = "/file_download?download_type=" + file_type +
    		"&file_id=" + version + "&file_type=" + file_format.slice(1);

   	var update_sql = "UPDATE UploadFile SET version=?, date=?, title=?, detail=?, download_url=? WHERE version=?";
   	db.run(update_sql, [version, date, title, detail, url, file_id]);  

	res.send("更新成功");

});

app.delete('/file_delete', function(req, res){
	var type = req.query.download_type;
	var file_name = req.query.file_id;
	var format = req.query.file_type;

  	var file_path = __dirname + '/file_storage/' + type + '/' + file_name + '.' + format;
	fs.unlinkSync(file_path);

	if(type == 'ios'){
		var plist_path = __dirname + '/public/plist/' + file_name + '.plist'; 
	}

	deleteRow(type, file_name);

	res.send("刪除成功");
});

var server = app.listen(8081, function () {

  	var host = server.address().address;
  	var port = server.address().port;

  	console.log("Example app listening at http://%s:%s", host, port);

})

// var scanDirectory = function(type){

// 	var scan_path = __dirname + '/file_storage/';

// 	var files = fs.readdirSync(scan_path + type);

// 	var file_data = [];

// 	for(var i in files){
// 		var stats = fs.statSync(scan_path + type + '/' + files[i]);
// 		var create_time = new Date(stats['mtime']);
// 		var year = create_time.getFullYear().toString();
// 		var month = (create_time.getMonth()+1).toString();
// 		var date = create_time.getDate().toString();
// 		var hour = create_time.getHours().toString();
// 		var minute = create_time.getMinutes().toString();
// 		// fs.stat(scan_path + type + '/' + files[i], function(err, stats) {
// 		file_data.push({
// 			'version' : files[i].slice(0, -4),
// 			'create_time' : year + '-' + month + '-' + date + " " + hour + ":" + minute
// 		});
// 	}

// 	return file_data;
// }

// var storeDB = function(file_id, data, file_format){
// 	var file_type = data.body.type;
// 	var version = data.body.version;
// 	var date = parseIsoTime();
// 	var intro = data.body.intro;
// 	var download_url = "/file_download?download_type=" + file_type +
//     		"&file_id=" + version + "&file_type=" + file_format.slice(1);

// 	var upload_sql = "INSERT INTO UploadFile(file_id, file_type, version, date, intro, download_url) VALUES (?,?,?,?,?,?)";
// 	db.run(upload_sql,[file_id, file_type, version, date, intro, download_url]);
// }



var deleteRow = function(type, id){

	var delete_sql = "DELETE FROM UploadFile WHERE file_type='" + 
		type  + "' AND file_id='" + id + "'";

	db.run(delete_sql, function(error) {
		if (error){
			console.log(error);
		}
	});
}


var parseIsoTime = function(){
	var create_time = new Date();
	var year = create_time.getFullYear().toString();
	var month = (create_time.getMonth()+1).toString();
	var date = create_time.getDate().toString();
	var hour = create_time.getHours().toString();
	var minute = create_time.getMinutes().toString();

	return  year + '-' + month + '-' + date + " " + hour + ":" + minute;
}