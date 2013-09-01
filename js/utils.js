
Object.extend = function(base, ext, withEnums) {
    var props = Object[(true === withEnums) ? 'getOwnPropertyNames' : 'keys'](ext);

    if (base.constructor === Array) {
        // Batch mode
        var nBases = base.length, i, j;
        while (nBases-- > 0)
            for (i=0, j=props.length; i < j; i++)
                base[nBases][props[i]] = ext[props[i]];
    } else {
        // Default
        for (var i=0, j=props.length; i < j; i++)
            base[props[i]] = ext[props[i]];
    }

    return base;
}

Object.prototype.extend = function(ext, withEnums) {
    return Object.extend(this, ext, withEnums);
};