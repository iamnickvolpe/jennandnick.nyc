var app = angular.module('myApp', []);

app.controller('myController', function ($scope, $http, $location, $anchorScroll, $timeout) {
    $scope.currentSubmission = {};
    $scope.formState = "initial";
    $scope.submitted = false;
    $scope.howManyAttending;

    $scope.scrollToRsvp = function () {
        $timeout(function () {
            $location.hash("rsvp");
            $anchorScroll();
        });
    }

    $scope.doFindInvitation = function (click) {
        if ($scope.currentSubmission.household && $scope.currentSubmission.code) {
            $scope.invalidCredentials = false;
            $scope.submitted = true;
            $http({
                method: 'GET',
                url: "/api/households/" + $scope.currentSubmission.household + "?code=" + $scope.currentSubmission.code
            }).then(function successCallback(response) {
                if (!response.data.error) {
                    $scope.currentSubmission.body = response.data;
                    if (response.data.updated) {
                        $scope.formState = "alreadySubmitted";
                    } else {
                        $scope.formState = "rsvp";
                        if (click) {
                            $scope.scrollToRsvp();
                        }
                    }
                } else {
                    $scope.invalidCredentials = true;
                }
                $scope.submitted = false;
            }, function errorCallback(response) {
                alert("There was a problem with the server. Please try again.");
                $scope.submitted = false;
            });
        }
    }

    $scope.doRsvp = function () {
        if ($scope.currentSubmission.household && $scope.currentSubmission.code && $scope.currentSubmission.body) {
            $scope.submitted = true;
            var body = {};
            body.addressee = $scope.currentSubmission.body.addressee;
            body.notes = $scope.currentSubmission.body.notes;
            body.guests = $scope.currentSubmission.body.guests.map(function (guest) {
                return {
                    name: guest.name,
                    id: guest.id,
                    attending: guest.attending,
                    email: guest.email
                }
            });

            $http({
                method: 'POST',
                url: "/api/households/" + $scope.currentSubmission.household + "?code=" + $scope.currentSubmission.code,
                data: body
            }).then(function successCallback(response) {
                if (!response.data.error) {
                    $scope.formState = "finished";
                    $scope.howManyAttending = howManyAttending($scope.currentSubmission.body.guests);

                } else {
                    alert("There was a problem with your submission. Please try again.");
                }
                $scope.submitted = false;
            }, function errorCallback(response) {
                alert("There was a problem with the server. Please try again.");
                $scope.submitted = false;
            });
        }
    }

    if ($location.search().household) {
        $scope.currentSubmission.household = $location.search().household;
    }

    if ($location.search().code) {
        $scope.currentSubmission.code = $location.search().code;
    }

    if ($scope.currentSubmission.household && $scope.currentSubmission.code) {
        $scope.doFindInvitation();
    }

    function howManyAttending(guests) {
        if (guests.every(isNotAttending)) {
            return "none";
        } else if (guests.every(isAttending)) {
            return "all";
        } else {
            return "some";
        }
    }

    function isNotAttending(guest) {
        return guest.attending === "FALSE";
    }

    function isAttending(guest) {
        return guest.attending === "TRUE";
    }

});

app.directive('myValidate', function () {
    return {
        require: 'ngModel',
        link: function (scope, element, attr, mCtrl) {
            function myValidation(value) {
                if (value.startsWith('=')) {
                    mCtrl.$setValidity('startsWithEquals', false);
                } else {
                    mCtrl.$setValidity('startsWithEquals', true);
                }
                return value;
            }
            mCtrl.$parsers.push(myValidation);
        }
    };
});

app.config(['$locationProvider', function ($locationProvider) {
    $locationProvider.html5Mode({
        enabled: true, requireBase: false
    });
}]);


var countDownDate = new Date("Oct 27, 2018 17:30:00").getTime();
var x = setInterval(function () {
    var now = new Date().getTime();
    var distance = countDownDate - now;

    var days = Math.floor(distance / (1000 * 60 * 60 * 24));
    var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById("date").innerHTML = days + "d " + hours + "h "
        + minutes + "m " + seconds + "s";

    if (distance < 0) {
        clearInterval(x);
        document.getElementById("date").innerHTML = "It's here!";
    }
}, 1000);
