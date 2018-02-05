var Bulb = (function () {
    function Bulb(position) {
        this.position = position;
        this.light = false;
    }
    return Bulb;
}());
var lightOn = "images/light_on.png";
var lightOff = "images/light_off.png";
var bulbs = [];
function PrintValue() {
    var value = 0;
    var position = 0;
    var text = "";
    for (var i = bulbs.length - 1; i >= 0; i--) {
        position = bulbs[i].position;
        if (bulbs[i].light == true) {
            value += Math.pow(2, position);
            text += "1 * " + Math.pow(2, position);
        }
        else {
            text += "0 * " + Math.pow(2, position);
        }
        if (i > 0) {
            text += " + ";
        }
    }
    text += " = " + value;
    var resultNode = document.getElementById("result");
    resultNode.innerHTML = text;
}
function Trigger(position) {
    var bulb = bulbs[position];
    bulb.light = !bulb.light;
    var img = document.getElementById('bulb' + position);
    if (bulb.light) {
        img.setAttribute("src", lightOn);
    }
    else {
        img.setAttribute("src", lightOff);
    }
    PrintValue();
}
function InsertImages(numberOfBulbs) {
    var divId = document.getElementById('bulbs');
    var _loop_1 = function (i) {
        var img = document.createElement("img");
        img.src = lightOff;
        img.id = "bulb" + i;
        img.onclick = function () {
            Trigger(i);
        };
        bulbs.push(new Bulb(numberOfBulbs - i - 1));
        img.title = "position: " + i;
        divId.appendChild(img);
    };
    for (var i = numberOfBulbs - 1; i >= 0; i--) {
        _loop_1(i);
    }
}
