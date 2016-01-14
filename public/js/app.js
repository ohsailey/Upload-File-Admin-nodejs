var app = angular.module('fileDownload', ['ngAnimate', 'ui.bootstrap']);


app.directive('fileModel', ['$parse', function($parse){
	return {
		restrict: 'A',
		link: function(scope, element, attrs){
			var model = $parse(attrs.fileModel);
			var modelSetter = model.assign;

			element.bind('change', function(){
				scope.$apply(function(){
					modelSetter(scope, element[0].files[0]);
				})
			})
		}
	}
}])


app.service('fileUpload', ['$http', function($http){

	this.post = function(data, platform){
	    var fd = new FormData();

		for(var key in data){
			fd.append(key, data[key]);
		}
		fd.append('type', platform);
		// if(data['type'] == 'ios'){
		// 	fd.append("file[]", data["ipa_file"]);
		// }

		console.log(fd);
		
		var url = '/upload';
		$http.post(url, fd, {
			transformRequest: angular.indentity,
			headers: { 'Content-Type': undefined }
		}).success(function(data) {			
			console.log("success!!");
			window.location.reload();
		}).error(function(){
	        console.log("error!!");
	    });
	}

	this.update = function(data){
	    var fd = new FormData();
		for(var key in data){
			fd.append(key, data[key]);
		}

		var url = '/update_info';
		$http.put(url, fd, {
			transformRequest: angular.indentity,
			headers: { 'Content-Type': undefined }
		}).success(function(data) {
			window.location.reload();
			console.log("success!!");
		}).error(function(){
	        console.log("error!!");
	    });
	}
}])


app.controller('FileCtrl', function ($scope, $http, $timeout, $window, fileUpload) {

	$scope.upload = {};
	$scope.upload_form_status = false;
	$scope.upload_status = true;

	$scope.progressVisible = false;

	$scope.purpose = 'add';

	$http.get("/file_list").success(function(data){
		$scope.android_list = data.android;
		$scope.ios_list = data.ios;
		$scope.web_list = data.web;

	}).error(function(){
        alert("error");
    });

    $scope.downloadFile = function(url){
    	window.location = url;
    }

    $scope.editFile = function(data){
    	$scope.upload_form_status = true;
    	$scope.upload_status = false;
    	$scope.purpose = 'update';
    	$scope.upload.file_id = data.version;
    	$scope.upload.version = data.version;
    	$scope.upload.title = data.title;
    	$scope.upload.description = data.description;
    	$scope.upload.type = data.platform;
    }

    $scope.deleteFile = function(file_id, file_type){
    	var req_body = {
    		'download_type': $scope.platform,
    		'file_id': file_id,
    		'file_type': file_type
    	};

    	$http.delete("/file_delete", {params: req_body}).success(function(data) {
			console.log("success!!");
			window.location.reload();
		}).error(function(){
	        console.log("error!!");
	    });
    }

    $scope.showUploadForm = function(){
    	$scope.upload_form_status = true;
    	$scope.upload_status = false;
    	$scope.purpose = 'add';
    	$scope.upload = {};
    }

    $scope.cancelUpload = function(){
    	$scope.upload_form_status = false;
    	$scope.upload_status = true;
    }

    $scope.updateUploadType = function(){
    	if($scope.upload.type == "ios"){
    		$scope.choose_ios = true;
    	}else{
    		$scope.choose_ios = false;
    	}
    	
    }

    $scope.uploadSubmit = function(isFormValid, $event){
    	var obj = $event.target;
		
		if (!isFormValid) {
			$scope.formStatus = 1;
		} else {
			if($scope.purpose == "add"){
				uploadFile();
				// fileUpload.post($scope.upload);
			}else{
				fileUpload.update($scope.upload);
			}
		}
    }


    $scope.switchTab = function(platform){
    	switch(platform){
    		case "android":
    			$scope.platform = 'android';
    			$scope.input_file_hint = "請選擇 apk檔案";
    			$scope.accept_format = ".apk";
    			break;
    		case "ios":
    			$scope.platform = 'ios';
    			$scope.input_file_hint = "請選擇 ipa檔案";
    			$scope.accept_format = ".ipa";
    			break;
    		case "web":
    			$scope.platform = 'web';
    			$scope.input_file_hint = "請選擇 exe檔案";
    			$scope.accept_format = ".exe";
    			break;
    	}
    }

    $scope.changeUploadFile = function(element){
    	$scope.file_name = element.files[0].name;
    }

    var uploadFile = function(){
    	var fd = new FormData();

    	for(var key in $scope.upload){
			fd.append(key, $scope.upload[key]);
		}
		fd.append('type', $scope.platform);

		var xhr = new XMLHttpRequest();
		xhr.upload.addEventListener("progress", uploadProgress, false);
		xhr.addEventListener("load", uploadComplete, false)
        xhr.addEventListener("error", uploadFailed, false)
		xhr.open("POST", "/upload");
		$scope.progressVisible = true;
		xhr.send(fd);
    }

    var uploadProgress = function(e){
    	progress_dom = document.getElementsByClassName("progress");
    	$scope.$apply(function(){
            if (e.lengthComputable) {
                $scope.progress = Math.round(e.loaded * 100 / e.total);
                $(".progress").css('width', $scope.progress + "%" );
                $(".text").html(Math.round($scope.progress) + "%");
            } else {
                scope.progress = 'unable to compute'
            }
        })
    }

    var uploadComplete = function(e) {
        window.location.reload();
    }

    var uploadFailed = function(e) {
        alert("There was an error attempting to upload the file.")
    }
});

