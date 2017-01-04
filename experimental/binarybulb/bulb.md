<html>

<head>
    <title>Binary Bulb Things</title>
    <script src="binaryBulb.js"></script>
    <style>
        #bulbs {
            float: left;
            margin-bottom: 25px;
        }

        #bulbs img {
            height: 100px;
            width: 80px;
        }

        #result {
            clear: both;
        }
    </style>
</head>
<body>
    <div id="bulbs">
    </div>
    <h1 id="result">= ?</h1>
    <script type="text/javascript">
        console.log("here!");
        let count = prompt("How many bulbs do you want?");
        InsertImages(count);
        PrintValue();
    </script>
</body>

</html>
