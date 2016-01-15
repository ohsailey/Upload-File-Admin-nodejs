var app = angular.module('fileDownload', ['ngAnimate', 'ui.bootstrap']);

app.controller('FileCtrl', function ($scope, $http, $window) {

	$http.get("/file_list").success(function(data){
		$scope.android_list = data.android;
		$scope.ios_list = data.ios;
		$scope.web_list = data.web;

	}).error(function(){
        alert("error");
    });
});